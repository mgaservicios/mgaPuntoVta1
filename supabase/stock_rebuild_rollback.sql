-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK — deshacer stock_rebuild.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Restaura el estado previo al rebuild desde las tablas de archivo que crea
-- stock_rebuild.sql. Correlo solo si el rebuild ya se aplicó de verdad
-- (dry_run = false) y algo quedó mal.
--
-- Requiere que existan las tres tablas de archivo. Si el rebuild corrió en
-- dry_run no hizo falta nada: la transacción ya se deshisó sola.
--
-- Restore completo: borra y reinserta, así también desaparecen las filas de
-- articulo_stock que el rebuild haya creado. stock_minimo vuelve con su valor
-- original.

begin;

-- ═══ Preflight ═══
do $$
begin
  if to_regclass('public._archivo_movimientos_stock') is null then
    raise exception
      'No existe _archivo_movimientos_stock. No hubo nada que deshacer, o el rebuild nunca se aplicó.';
  end if;
  if to_regclass('public._backup_articulo_stock') is null then
    raise exception 'No existe _backup_articulo_stock.';
  end if;
  if to_regclass('public._backup_derivados_stock') is null then
    raise exception 'No existe _backup_derivados_stock.';
  end if;
end
$$;


-- ═══ 1. Movimientos ═══
delete from public.movimientos_stock;

insert into public.movimientos_stock
  select * from public._archivo_movimientos_stock;

-- La secuencia quedó muy arriba después del rebuild. Sin esto, los movimientos
-- nuevos arrancarían en un id enorme.
select setval(
  pg_get_serial_sequence('public.movimientos_stock','id'),
  coalesce((select max(id) from public.movimientos_stock), 1),
  true
);


-- ═══ 2. Stock por sucursal ═══
delete from public.articulo_stock;

insert into public.articulo_stock
  select * from public._backup_articulo_stock;

-- Idem para la secuencia de articulo_stock.
select setval(
  pg_get_serial_sequence('public.articulo_stock','id'),
  coalesce((select max(id) from public.articulo_stock), 1),
  true
);


-- ═══ 3. Campos derivados ═══
update public.articulos a
   set stock_actual = b.stock_actual
  from public._backup_derivados_stock b
 where b.nivel = 'articulo'
   and b.id = a.id;

update public.articulo_variantes v
   set stock_actual = b.stock_actual
  from public._backup_derivados_stock b
 where b.nivel = 'variante'
   and b.id = v.id;


-- ═══ 4. Verificación ═══
do $$
declare
  v_dif int;
  v_huerfanas int;
begin
  -- Filas que quedaron en articulo_stock y no existían antes del rebuild.
  select count(*) into v_huerfanas
  from public.articulo_stock st
  left join public._backup_articulo_stock b on b.id = st.id
  where b.id is null;

  -- Filas restauradas con un saldo distinto al original.
  select count(*) into v_dif
  from public.articulo_stock st
  join public._backup_articulo_stock b on b.id = st.id
  where st.stock_actual is distinct from b.stock_actual;

  raise notice 'Filas de más sin eliminar:    %  (debe ser 0)', v_huerfanas;
  raise notice 'Saldos que no restauraron:    %  (debe ser 0)', v_dif;

  if v_dif > 0 or v_huerfanas > 0 then
    raise exception 'Verificación fallida. Se aborta la transacción.';
  end if;

  raise notice 'Rollback verificado';
end
$$;

commit;
