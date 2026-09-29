-- ═══════════════════════════════════════════════════════════════════════════
-- RECONSTRUCCIÓN DE STOCK DESDE DOCUMENTOS
-- ═══════════════════════════════════════════════════════════════════════════
-- Reemplaza por completo los backfills incrementales. Calcula el stock real
-- sumando los documentos que lo originaron y regenera el historial de
-- movimientos a partir de la misma fuente, para que ambos no puedan divergir.
--
--   + remitos de entrada confirmados
--   - remitos de salida confirmados
--   - venta_items de ventas completadas
--   - orden_venta_items de ordenes de venta confirmadas
--   - optica_orden_items de OT no anuladas (armazones de catálogo)
--
-- REQUISITOS (aplicar antes):
--   1. supabase/migrations/20260929_stock_consistencia.sql
--   2. supabase/migrations/20260930_stock_rebuild_refs.sql
--   3. supabase/stock_rebuild_auditoria.sql — correr y revisar el reporte
--
-- CÓMO CORRERLO:
--   1. Probalo con dry_run = true. Se aplica todo y se deshace al final.
--   2. Con dry_run = false, aplica de verdad.
--   3. Guardá el reporte que imprime al final: es la verificación.
--
-- ROLLBACK: supabase/stock_rebuild_rollback.sql
--
-- Todo corre dentro de una transacción. O entra todo o no entra nada.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- Configuración — acá se cambian los dos valores
-- ═══════════════════════════════════════════════════════════════════════════
create temp table _rb_config on commit drop as
select
  'd4f5fc7d-710b-44fc-8299-60fab9587c05'::uuid as admin_uuid,
  true::boolean as dry_run;   -- ← poné false cuando quieras aplicar de verdad


-- ═══════════════════════════════════════════════════════════════════════════
-- 0. Preflight — falla temprano y con mensaje claro
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_admin uuid;
begin
  select admin_uuid into v_admin from _rb_config;

  if not exists (select 1 from public.users where id = v_admin) then
    raise exception
      'El admin_uuid % no existe en public.users. Corregí _rb_config en este script.', v_admin;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='ventas' and column_name='created_by'
  ) then
    raise exception
      'Falta ventas.created_by. Aplicar primero 20260930_stock_rebuild_refs.sql.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='movimientos_stock' and column_name='remito_id'
  ) then
    raise exception
      'Faltan las columnas remito_id/orden_venta_id/optica_orden_id. Aplicar primero 20260930_stock_rebuild_refs.sql.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.movimientos_stock'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%anulacion_ot%'
  ) then
    raise exception
      'El CHECK de movimientos_stock.tipo no incluye ''anulacion_ot''. Aplicar primero 20260929_stock_consistencia.sql.';
  end if;

  raise notice 'Preflight OK';
end
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Fuentes normalizadas
--    Idéntica a la del reporte, para que ambos no puedan divergir.
-- ═══════════════════════════════════════════════════════════════════════════
create temp table _rb_fuentes on commit drop as
select
  'remito_entrada'::text as doc_tipo,
  r.id            as doc_id,
  r.numero        as doc_numero,
  ri.id           as item_id,
  ri.articulo_id,
  ri.variante_id,
  r.sucursal_id,
  ri.cantidad     as delta,
  'entrada'::text as tipo_mov,
  r.fecha,
  0               as prioridad,
  r.created_by    as autor,
  r.contraparte_proveedor_id as proveedor_id,
  ri.costo_unitario          as costo,
  r.id            as ref_remito,
  null::bigint    as ref_orden_venta,
  null::bigint    as ref_optica_orden,
  null::bigint    as ref_venta,
  null::bigint    as ref_venta_item,
  'entrada de remito ' || r.numero as descripcion
from public.remitos r
join public.remito_items ri on ri.remito_id = r.id
where r.tipo = 'entrada'
  and r.estado = 'confirmado'

union all
select
  'remito_salida', r.id, r.numero, ri.id,
  ri.articulo_id, ri.variante_id, r.sucursal_id,
  -ri.cantidad, 'salida', r.fecha,
  1, r.created_by, r.contraparte_proveedor_id, ri.costo_unitario,
  r.id, null, null, null, null,
  'salida de remito ' || r.numero
from public.remitos r
join public.remito_items ri on ri.remito_id = r.id
where r.tipo = 'salida'
  and r.estado = 'confirmado'

union all
-- Ventas POS: created_by es NULL en las históricas, se completa con el admin.
-- Para las futuras la app lo setea (ver app/api/dashboard/ventas/route.ts).
-- costo va en NULL: precio_unitario es precio de venta, y costo_unitario se usa
-- para valuar inventario. Meter un precio de venta ahí corrompe la valuación.
select
  'venta', v.id, v.numero, vi.id,
  vi.articulo_id, vi.variante_id, v.sucursal_id,
  -vi.cantidad, 'venta', v.fecha::timestamptz,
  1, coalesce(v.created_by, (select admin_uuid from _rb_config)), null, null,
  null, null, null, v.id, vi.id,
  'venta POS ' || v.numero
from public.ventas v
join public.venta_items vi on vi.venta_id = v.id
where v.estado = 'completada'

union all
select
  'orden_venta', ov.id, ov.numero, ovi.id,
  ovi.articulo_id, ovi.variante_id, ov.sucursal_id,
  -ovi.cantidad, 'orden', ov.fecha::timestamptz,
  1, ov.created_by, null, null,
  null, ov.id, null, null, null,
  'orden de venta ' || ov.numero
from public.ordenes_venta ov
join public.orden_venta_items ovi on ovi.orden_id = ov.id
where ov.estado = 'confirmada'

union all
-- OT: el armazón se consume al crear la orden, así que cuenta en cualquier
-- estado salvo 'anulado'. Los servicios y los armazones del cliente no
-- afectan stock, y por eso se filtran por armazon_propio.
select
  'optica', o.id, o.numero, i.id,
  i.articulo_id, i.variante_id, o.sucursal_id,
  -i.cantidad, 'optica', o.fecha::timestamptz,
  1, o.created_by, null, null,
  null, null, o.id, null, null,
  'orden de trabajo de óptica ' || o.numero
from public.optica_ordenes o
join public.optica_orden_items i on i.orden_id = o.id
where o.estado <> 'anulado'
  and o.sucursal_id is not null
  and i.articulo_id is not null
  and i.armazon_propio is not true
  and i.cantidad > 0;


-- Saldo por clave (articulo, variante, sucursal)
create temp table _rb_saldos on commit drop as
select articulo_id, variante_id, sucursal_id, sum(delta) as saldo
from _rb_fuentes
group by articulo_id, variante_id, sucursal_id;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Archivar el estado actual
--    Solo la primera corrida archiva. Las siguientes conservan el original
--    intacto, así el rollback siempre vuelve al punto de partida.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public._archivo_movimientos_stock') is null then
    execute 'create table public._archivo_movimientos_stock as select * from public.movimientos_stock';
    raise notice 'Archivado _archivo_movimientos_stock';
  else
    raise notice '_archivo_movimientos_stock ya existe, se conserva el original';
  end if;

  if to_regclass('public._backup_articulo_stock') is null then
    execute 'create table public._backup_articulo_stock as select * from public.articulo_stock';
    raise notice 'Archivado _backup_articulo_stock';
  end if;

  if to_regclass('public._backup_derivados_stock') is null then
    execute 'create table public._backup_derivados_stock as
             select ''articulo'' as nivel, id, stock_actual from public.articulos
             union all
             select ''variante'', id, stock_actual from public.articulo_variantes';
    raise notice 'Archivado _backup_derivados_stock';
  end if;
end
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Regenerar movimientos
-- ═══════════════════════════════════════════════════════════════════════════
delete from public.movimientos_stock;

-- Saldo acumulado por clave. El orden pone las entradas antes que las salidas
-- dentro de la misma fecha para no generar negativos intermedios falsos.
-- Se particiona por variante_id y NULL cae en su propia partición, que es lo
-- correcto: las filas sin variante son una única serie.
insert into public.movimientos_stock
  (articulo_id, variante_id, sucursal_id, tipo, cantidad, costo_unitario,
   stock_antes, stock_despues, usuario_id, referencia, observaciones,
   venta_id, venta_item_id, proveedor_id,
   remito_id, orden_venta_id, optica_orden_id, created_at)
select
  articulo_id,
  variante_id,
  sucursal_id,
  tipo_mov,
  abs(delta)             as cantidad,   -- siempre positiva; el signo lo da el tipo
  costo,
  stock_antes,
  stock_antes + delta    as stock_despues,
  autor,
  doc_numero         as referencia,
  descripcion        as observaciones,
  ref_venta,
  ref_venta_item,
  proveedor_id,
  ref_remito,
  ref_orden_venta,
  ref_optica_orden,
  fecha              as created_at
from (
  select
    f.*,
    coalesce(
      sum(f.delta) over (
        partition by f.articulo_id, f.variante_id, f.sucursal_id
        order by f.fecha, f.prioridad, f.doc_id, f.item_id
        rows between unbounded preceding and 1 preceding
      ),
      0
    ) as stock_antes
  from _rb_fuentes f
) m
order by m.fecha, m.prioridad, m.doc_id, m.item_id;

-- created_at quedó explícito para conservar la fecha del documento. Se resetea
-- la secuencia del identity para que los movimientos siguientes sigan la
-- numeración correlativa desde el último id insertado.
select setval(
  pg_get_serial_sequence('public.movimientos_stock','id'),
  coalesce((select max(id) from public.movimientos_stock), 1),
  true
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Reconstruir articulo_stock
--    stock_minimo NO se toca: no es derivable de los documentos.
-- ═══════════════════════════════════════════════════════════════════════════

-- 4a. Filas existentes: al saldo reconstruido, o 0 si ningún documento las
--     respalda (stock huérfano, reportado en la auditoría).
update public.articulo_stock st
   set stock_actual = coalesce((
         select c.saldo from _rb_saldos c
          where c.articulo_id   = st.articulo_id
            and c.sucursal_id   = st.sucursal_id
            and c.variante_id is not distinct from st.variante_id
       ), 0),
       updated_at = now();

-- 4b. Claves que los documentos mencionan pero que no tienen fila todavía.
insert into public.articulo_stock
  (articulo_id, variante_id, sucursal_id, stock_actual, stock_minimo)
select c.articulo_id, c.variante_id, c.sucursal_id, c.saldo, 0
from _rb_saldos c
where not exists (
  select 1 from public.articulo_stock st
   where st.articulo_id   = c.articulo_id
     and st.sucursal_id   = c.sucursal_id
     and st.variante_id is not distinct from c.variante_id
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Campos derivados
--    Replica exactamente services/stock.ts:syncArticuloStock, incluida la
--    regla de que si el artículo tiene filas con variante, articulos.stock_actual
--    suma solo las variantes y descarta las filas sin variante.
-- ═══════════════════════════════════════════════════════════════════════════
update public.articulo_variantes v
   set stock_actual = coalesce((
         select sum(st.stock_actual) from public.articulo_stock st
          where st.variante_id = v.id
       ), 0)
 where exists (select 1 from public.articulo_stock st where st.variante_id = v.id)
    or v.stock_actual <> 0;

update public.articulos a
   set stock_actual = case
     when exists (select 1 from public.articulo_stock st
                   where st.articulo_id = a.id and st.variante_id is not null)
       then coalesce((select sum(st.stock_actual) from public.articulo_stock st
                       where st.articulo_id = a.id and st.variante_id is not null), 0)
       else coalesce((select sum(st.stock_actual) from public.articulo_stock st
                       where st.articulo_id = a.id and st.variante_id is null), 0)
   end
 where exists (select 1 from public.articulo_stock st where st.articulo_id = a.id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Verificación
--    Todo tiene que dar 0 salvo los conteos informativos.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_roto int;
  v_descuadre int;
  v_deriva_derivados int;
begin
  -- La cadena de saldos debe ser continua: el stock_despues de un movimiento
  -- tiene que ser el stock_antes del siguiente, para la misma clave.
  select count(*) into v_roto
  from (
    select
      m.stock_despues,
      lag(m.stock_antes) over (
        partition by m.articulo_id, m.variante_id, m.sucursal_id
        order by m.created_at, m.id
      ) as prev_antes
    from public.movimientos_stock m
  ) x
  where prev_antes is not null
    and stock_despues is distinct from prev_antes;

  -- El último stock_despues de cada clave tiene que ser el stock_actual.
  with ultimo as (
    select
      articulo_id, variante_id, sucursal_id, stock_despues,
      row_number() over (
        partition by articulo_id, variante_id, sucursal_id
        order by created_at desc, id desc
      ) as rn
    from public.movimientos_stock
  )
  select count(*) into v_descuadre
  from ultimo u
  join public.articulo_stock st
    on st.articulo_id   = u.articulo_id
   and st.sucursal_id   = u.sucursal_id
   and st.variante_id is not distinct from u.variante_id
  where u.rn = 1
    and st.stock_actual is distinct from u.stock_despues;

  -- Los derivados deben coincidir con la suma de articulo_stock.
  select count(*) into v_deriva_derivados
  from public.articulos a
  where a.stock_actual is distinct from coalesce((
          select case
            when exists (select 1 from public.articulo_stock st
                          where st.articulo_id = a.id and st.variante_id is not null)
              then (select sum(st.stock_actual) from public.articulo_stock st
                     where st.articulo_id = a.id and st.variante_id is not null)
              else (select sum(st.stock_actual) from public.articulo_stock st
                     where st.articulo_id = a.id and st.variante_id is null)
          end), 0);

  raise notice '── Verificación ──';
  raise notice 'cadena rota:            %  (debe ser 0)', v_roto;
  raise notice 'descuadre con stock:    %  (debe ser 0)', v_descuadre;
  raise notice 'deriva en derivados:    %  (debe ser 0)', v_deriva_derivados;

  if v_roto > 0 or v_descuadre > 0 or v_deriva_derivados > 0 then
    raise exception 'Verificación fallida. Se aborta la transacción.';
  end if;

  raise notice 'Verificación OK';
end
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Reporte final — guardalo: es la verificación de lo que se aplicó
-- ═══════════════════════════════════════════════════════════════════════════
select
  (select count(*) from public.movimientos_stock)                      as movimientos,
  (select count(*) from public.movimientos_stock where tipo='entrada') as entradas,
  (select count(*) from public.movimientos_stock where tipo='salida')  as salidas,
  (select count(*) from public.movimientos_stock where tipo='venta')   as ventas,
  (select count(*) from public.movimientos_stock where tipo='orden')   as ordenes_venta,
  (select count(*) from public.movimientos_stock where tipo='optica')  as ot,
  (select count(*) from public.articulo_stock)                         as filas_stock,
  (select count(*) from public.articulo_stock where stock_actual < 0)  as saldos_negativos,
  (select coalesce(sum(stock_actual),0) from public.articulo_stock)    as unidades_totales;


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Control de dry run
-- ═══════════════════════════════════════════════════════════════════════════
do $$
begin
  if (select dry_run from _rb_config) then
    raise exception
      'DRY RUN — se deshace todo. Cambiá dry_run a false en _rb_config para aplicar de verdad.';
  end if;
end
$$;

commit;
