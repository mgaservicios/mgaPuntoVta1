-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECCIÓN DE FECHAS ROTOS EN DOCUMENTOS
-- ═══════════════════════════════════════════════════════════════════════════
-- Por qué: hay documentos con año de 1 a 4 dígitos (0008, 0026, 1224). No son
-- fechas, son valores mal parseados. Ordenan mal el historial de stock y
-- salen fuera de todo filtro de fechas.
--
-- Las 5 rotas comparten la hora exacta 15:53:48+00, así que la parte de hora
-- no se tocó: la de fecha se generó mal.
--
-- QUÉ TOCA: solo filas con fecha fuera del rango 2000-2100. Idempotente:
-- correrlo dos veces no cambia nada la segunda vez.
--
-- CÓMO CORRERLO — un solo pegado (el editor usa transaction pooling):
--   1. Dejá aplicar = false. Imprime la propuesta, no escribe nada.
--   2. Revisá la propuesta con el usuario.
--   3. Poné aplicar = true. Aplica.
--
-- Si la propuesta de una fila no te sirve, poné el valor correcto en la tabla
-- `_fix_fechas_override` (abajo) antes de aplicar. Tiene prioridad sobre todo
-- lo demás.
--
-- ROLLBACK: no hace falta, es una sola transacción.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- Configuración
-- ═══════════════════════════════════════════════════════════════════════════
drop table if exists _fix_fechas_config;
create table _fix_fechas_config as
select false::boolean as aplicar;   -- ← poné true cuando quieras escribir

-- ═══════════════════════════════════════════════════════════════════════════
-- Override manual. VACÍO a propósito.
-- Formato: ('remitos' | 'optica_ordenes', id, 'YYYY-MM-DD HH24:MI:SS+00', motivo)
-- Ejemplo: ('remitos', 434, '2026-07-31 00:00:00+00', 'fecha real del papel')
-- ═══════════════════════════════════════════════════════════════════════════
drop table if exists _fix_fechas_override;
create table _fix_fechas_override (
  tabla   text,
  doc_id  bigint,
  fecha   timestamptz,
  motivo  text
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Qué filas están rotas
-- ═══════════════════════════════════════════════════════════════════════════
drop table if exists _fix_fechas_roto;
create table _fix_fechas_roto as
select 'remitos'::text as tabla, r.id as doc_id, r.numero as doc_numero,
       r.estado, r.fecha as fecha_rota, r.created_at,
       'salida'::text as tipo_doc
from public.remitos r
where r.fecha < '2000-01-01' or r.fecha > '2100-01-01'

union all

select 'optica_ordenes', o.id, o.numero,
       o.estado, o.fecha, o.created_at,
       'ot'
from public.optica_ordenes o
where o.fecha < '2000-01-01' or o.fecha > '2100-01-01';

-- ═══════════════════════════════════════════════════════════════════════════
-- Propuesta. Por defecto created_at (el momento real en que se creó la fila).
-- Cuando el año roto es de 1 o 2 dígitos se propone también la lectura
-- "2000 + año" por si el valor fuera el año bien escrito con ceros de más.
-- ═══════════════════════════════════════════════════════════════════════════
drop table if exists _fix_fechas_propuesta;
create table _fix_fechas_propuesta as
select
  f.tabla,
  f.doc_id,
  f.doc_numero,
  f.estado,
  f.tipo_doc,
  f.fecha_rota,
  f.created_at,
  (f.created_at at time zone 'UTC')::date::timestamp
    at time zone 'UTC'                                     as propuesta_defecto,
  case
    when extract(year from f.fecha_rota) between 1 and 99
      then make_date(2000 + extract(year from f.fecha_rota)::int,
                     extract(month from f.fecha_rota)::int,
                     extract(day   from f.fecha_rota)::int)
           at time zone 'UTC'
  end                                                      as propuesta_lectura_anio,
  ov.fecha                                                  as override,
  coalesce(ov.motivo, 'created_at (default)')              as motivo
from _fix_fechas_roto f
left join _fix_fechas_override ov
  on ov.tabla = f.tabla and ov.doc_id = f.doc_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación previa: si el override apunta a algo que no existe o sigue
-- roto, mejor abortar ahora que dejar basura.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_malo text;
begin
  select string_agg(format('%s #%s -> %s', p.tabla, p.doc_id, p.override), ', ')
    into v_malo
  from _fix_fechas_propuesta p
  where p.override is not null
    and (p.override < '2000-01-01' or p.override > '2100-01-01');

  if v_malo is not null then
    raise exception 'Override con fecha todavía rota: %', v_malo;
  end if;

  if exists (
    select 1 from _fix_fechas_override ov
    where not exists (
      select 1 from _fix_fechas_roto f
      where f.tabla = ov.tabla and f.doc_id = ov.doc_id
    )
  ) then
    raise exception
      'Hay overrides para documentos que NO están rotos. Revisá la tabla _fix_fechas_override.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Aplicar
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_aplicar boolean;
  v_afectadas integer;
begin
  select aplicar into v_aplicar from _fix_fechas_config;

  if not v_aplicar then
    raise notice 'aplicar = false: no se escribe nada. Revisá la propuesta de abajo.';
    return;
  end if;

  update public.remitos r
  set fecha = p.valor
  from (
    select doc_id,
           coalesce(override, propuesta_defecto) as valor
    from _fix_fechas_propuesta
    where tabla = 'remitos'
  ) p
  where r.id = p.doc_id;

  get diagnostics v_afectadas = row_count;

  update public.optica_ordenes o
  set fecha = p.valor
  from (
    select doc_id,
           coalesce(override, propuesta_defecto) as valor
    from _fix_fechas_propuesta
    where tabla = 'optica_ordenes'
  ) p
  where o.id = p.doc_id;

  get diagnostics v_afectadas = v_afectadas + row_count;

  raise notice 'Fechas corregidas: %', v_afectadas;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Resultado. Es la última query del pegado, así que es lo que muestra el editor.
-- ═══════════════════════════════════════════════════════════════════════════
select
  (select aplicar from _fix_fechas_config)                            as aplico,
  p.tabla,
  p.doc_id,
  p.doc_numero,
  p.estado,
  p.tipo_doc,
  p.fecha_rota,
  p.created_at,
  p.propuesta_defecto,
  p.propuesta_lectura_anio,
  p.override,
  p.motivo
from _fix_fechas_propuesta p
order by p.tabla, p.doc_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- Limpieza de las tablas de trabajo
-- ═══════════════════════════════════════════════════════════════════════════
drop table if exists _fix_fechas_config;
drop table if exists _fix_fechas_override;
drop table if exists _fix_fechas_roto;
drop table if exists _fix_fechas_propuesta;

commit;
