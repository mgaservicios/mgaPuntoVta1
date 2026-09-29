-- ═══════════════════════════════════════════════════════════════════════════
-- REPORTE (no modifica nada) — Reconstrucción de stock desde documentos
-- ═══════════════════════════════════════════════════════════════════════════
-- Correr ANTES de supabase/stock_rebuild.sql.
--
-- Calcula, sin escribir nada, el stock que resulta de sumar los documentos:
--   + remitos de entrada confirmados
--   - remitos de salida confirmados
--   - venta_items de ventas completadas
--   - orden_venta_items de ordenes de venta confirmadas
--   - optica_orden_items de OT no anuladas (armazones de catálogo)
--
-- `_rb_fuentes` es una tabla COMÚN, no temporal, a propósito.
--
-- El editor de Supabase va por PgBouncer en modo transaction pooling: la
-- conexión al backend se libera al terminar cada transacción, así que una
-- TEMP TABLE no sobrevive entre dos ejecuciones. Con una tabla común el
-- reporte se puede correr en tres tramos (crear / consultar / borrar) y las
-- secciones leen el mismo material.
--
-- No modifica datos de negocio. Lo único que escribe es esta tabla, que se
-- borra al final. NO correr dentro de una transacción abierta: el `begin;`
-- justamente provoca el cierre de la conexión.
--
-- Todas las consultas son de solo lectura.

-- ═══════════════════════════════════════════════════════════════════════════
-- Fuente única normalizada. Las 5 se definen acá y todas las secciones de
-- abajo leen de acá, para que el reporte y el rebuild no puedan divergir.
--
-- `prioridad` ordena las entradas antes que las salidas dentro de la misma
-- fecha, para que el saldo acumulado no muestre negativos intermedios falsos
-- cuando en un mismo día entró y salió el mismo artículo.
-- ═══════════════════════════════════════════════════════════════════════════
drop table if exists _rb_fuentes;

create table _rb_fuentes as
select
  'remito_entrada'::text                      as doc_tipo,
  r.id                                         as doc_id,
  r.numero                                     as doc_numero,
  ri.id                                        as item_id,
  ri.articulo_id,
  ri.variante_id,
  r.sucursal_id,
  ri.cantidad                                  as delta,
  'entrada'::text                              as tipo_mov,
  r.fecha                                      as fecha,
  0                                            as prioridad,
  r.created_by                                 as autor,
  r.contraparte_nombre                         as contraparte
from public.remitos r
join public.remito_items ri on ri.remito_id = r.id
where r.tipo = 'entrada'
  and r.estado = 'confirmado'

union all
-- Remito de salida: descuenta de la sucursal emisora.
select
  'remito_salida', r.id, r.numero, ri.id,
  ri.articulo_id, ri.variante_id, r.sucursal_id,
  -ri.cantidad, 'salida', r.fecha,
  1, r.created_by, r.contraparte_nombre
from public.remitos r
join public.remito_items ri on ri.remito_id = r.id
where r.tipo = 'salida'
  and r.estado = 'confirmado'

union all
-- Venta POS: solo 'completada' (no hay estado borrador, solo completada/anulada).
select
  'venta', v.id, v.numero, vi.id,
  vi.articulo_id, vi.variante_id, v.sucursal_id,
  -vi.cantidad, 'venta', v.fecha::timestamptz,
  1, v.created_by, v.vendedor_id::text
from public.ventas v
join public.venta_items vi on vi.venta_id = v.id
where v.estado = 'completada'

union all
-- Orden de venta: solo 'confirmada' (borrador no movió stock, anulada lo revierte).
select
  'orden_venta', ov.id, ov.numero, ovi.id,
  ovi.articulo_id, ovi.variante_id, ov.sucursal_id,
  -ovi.cantidad, 'orden', ov.fecha::timestamptz,
  1, ov.created_by, null
from public.ordenes_venta ov
join public.orden_venta_items ovi on ovi.orden_id = ov.id
where ov.estado = 'confirmada'

union all
-- OT de óptica: el armazón se consume al crear la orden, así que cuenta en
-- cualquier estado salvo 'anulado'. Los servicios (cristal, tratamiento) y los
-- armazones del cliente no afectan stock.
select
  'optica', o.id, o.numero, i.id,
  i.articulo_id, i.variante_id, o.sucursal_id,
  -i.cantidad, 'optica', o.fecha::timestamptz,
  1, o.created_by, null
from public.optica_ordenes o
join public.optica_orden_items i on i.orden_id = o.id
where o.estado <> 'anulado'
  and o.sucursal_id is not null
  and i.articulo_id is not null
  and i.armazon_propio is not true
  and i.cantidad > 0;

-- ═══ 1. Volumen por fuente ═══
select
  doc_tipo,
  count(*)                                   as lineas,
  count(distinct doc_id)                     as documentos,
  count(distinct (articulo_id, variante_id, sucursal_id)) as claves,
  sum(delta)                                 as unidades_netas,
  min(fecha)::date                           as desde,
  max(fecha)::date                           as hasta
from _rb_fuentes
group by doc_tipo
order by doc_tipo;


-- ═══ 2. Ventas sin autor conocido ═══
-- Requieren el usuario admin como fallback (usuario_id es NOT NULL en
-- movimientos_stock). Si acá sale 0, la migración 20260930 ya se corrió después
-- de las ventas y se puede usar el autor real de todas.
select
  count(*)                                  as ventas_sin_autor,
  count(distinct v.sucursal_id)             as sucursales_afectadas,
  min(v.fecha)                              as desde,
  max(v.fecha)                              as hasta
from public.ventas v
join public.venta_items vi on vi.venta_id = v.id
where v.estado = 'completada'
  and v.created_by is null;


-- ═══ 3. Documentos excluidos por estado ═══
-- No se van a sumar. Se listan para que se decida si alguna debería entrar.
select 'remito' as tipo_doc, r.estado, r.tipo as subtipo,
       count(distinct r.id) as documentos,
       coalesce(sum(ri.cantidad), 0) as unidades,
       min(r.fecha)::date as desde, max(r.fecha)::date as hasta
from public.remitos r
join public.remito_items ri on ri.remito_id = r.id
where r.estado <> 'confirmado'
group by r.estado, r.tipo

union all
select 'orden_venta', ov.estado, null,
       count(distinct ov.id),
       coalesce(sum(ovi.cantidad), 0),
       min(ov.fecha), max(ov.fecha)
from public.ordenes_venta ov
join public.orden_venta_items ovi on ovi.orden_id = ov.id
where ov.estado <> 'confirmada'
group by ov.estado

union all
select 'venta', v.estado, null,
       count(distinct v.id),
       coalesce(sum(vi.cantidad), 0),
       min(v.fecha), max(v.fecha)
from public.ventas v
join public.venta_items vi on vi.venta_id = v.id
where v.estado <> 'completada'
group by v.estado

union all
select 'optica_orden', o.estado, null,
       count(distinct o.id),
       coalesce(sum(i.cantidad), 0),
       min(o.fecha), max(o.fecha)
from public.optica_ordenes o
join public.optica_orden_items i on i.orden_id = o.id
where o.estado = 'anulado'
group by o.estado
order by 1, 2;


-- ═══ 4. Stock huérfano: se pondría en 0 ═══
-- Filas de articulo_stock con saldo distinto de cero que ningún documento
-- respalda. El rebuild las deja en 0. Si acá salen muchas, hay stock cargado
-- por una vía que no está en los documentos y hay que investigarlo antes.
with saldos as (
  select articulo_id, variante_id, sucursal_id, sum(delta) as calculado
  from _rb_fuentes
  group by articulo_id, variante_id, sucursal_id
)
select
  s.sucursal_id,
  a.codigo,
  a.nombre,
  s.variante_id,
  s.stock_actual                       as stock_actual_hoy,
  coalesce(c.calculado, 0)             as stock_reconstruido,
  s.stock_actual - coalesce(c.calculado, 0) as se_pierde,
  s.stock_minimo
from public.articulo_stock s
join public.articulos a on a.id = s.articulo_id
left join saldos c
  on c.articulo_id = s.articulo_id
 and c.sucursal_id = s.sucursal_id
 and c.variante_id is not distinct from s.variante_id
where s.stock_actual <> 0
  and c.articulo_id is null
order by abs(s.stock_actual) desc
limit 100;


-- ═══ 5. Claves de documentos sin fila en articulo_stock ═══
-- El rebuild las crea con el stock calculado. Si son muchas, es porque las
-- ventas u OTs se registraron sin dar de alta el stock en esa sucursal.
 

-- ═══ 6. Claves que quedan en negativo ═══
-- Saldo reconstruido menor que cero: se consumió más de lo que entró por
-- documentos. O falta un remito de entrada, o hubo una venta/OT que no está
-- respaldada. Con controla_stock activo, la app va a bloquear la venta de
-- estos artículos hasta regularizarlo.
with saldos as (
  select articulo_id, variante_id, sucursal_id, sum(delta) as calculado
  from _rb_fuentes
  group by articulo_id, variante_id, sucursal_id
)
select
  s.sucursal_id,
  a.codigo,
  a.nombre,
  s.variante_id,
  s.calculado                                    as saldo_reconstruido,
  coalesce(st.stock_actual, 0)                   as stock_actual_hoy,
  st.stock_actual - s.calculado                  as correccion
from saldos s
join public.articulos a on a.id = s.articulo_id
left join public.articulo_stock st
  on st.articulo_id = s.articulo_id
 and st.sucursal_id = s.sucursal_id
 and st.variante_id is not distinct from s.variante_id
where s.calculado < 0
order by s.calculado
limit 100;


-- ═══ 7. Deriva: cuánto se mueve el stock por clave ═══
-- Resumen, no detalle. Si la deriva es grande hay que entenderla antes de
-- aplicar: puede ser que hoy el stock esté mal, no el rebuild.
with saldos as (
  select articulo_id, variante_id, sucursal_id, sum(delta) as calculado
  from _rb_fuentes
  group by articulo_id, variante_id, sucursal_id
),
comparado as (
  select
    coalesce(c.articulo_id, st.articulo_id)        as articulo_id,
    coalesce(c.sucursal_id, st.sucursal_id)        as sucursal_id,
    coalesce(c.variante_id, st.variante_id)        as variante_id,
    coalesce(c.calculado, 0)                        as reconstruido,
    coalesce(st.stock_actual, 0)                   as hoy
  from saldos c
  full outer join public.articulo_stock st
    on st.articulo_id = c.articulo_id
   and st.sucursal_id = c.sucursal_id
   and st.variante_id is not distinct from c.variante_id
)
select
  case
    when reconstruido = hoy then 'sin cambio'
    when reconstruido < 0 and hoy >= 0 then 'hoy positivo -> queda negativo'
    when reconstruido >= 0 and hoy < 0 then 'hoy negativo -> queda positivo'
    when reconstruido = 0 and hoy <> 0 then 'se agota'
    else 'ajuste'
  end                                            as tipo_deriva,
  count(*)                                       as claves,
  sum(abs(reconstruido - hoy))                    as unidades_en_juego,
  min(hoy - reconstruido)                        as mayor_bajada,
  max(hoy - reconstruido)                        as mayor_subida
from comparado
group by 1
order by claves desc;


-- ═══ 8. Totales ═══
-- El control de cuadre: la suma de todos los deltas tiene que ser igual al
-- total de stock reconstruido sobre todas las claves.
with saldos as (
  select articulo_id, variante_id, sucursal_id, sum(delta) as calculado
  from _rb_fuentes
  group by articulo_id, variante_id, sucursal_id
)
select
  (select count(*) from public.articulo_stock)  as filas_articulo_stock_hoy,
  (select count(*) from saldos)                 as claves_reconstruidas,
  (select coalesce(sum(calculado),0) from saldos) as unidades_reconstruidas,
  (select coalesce(sum(stock_actual),0) from public.articulo_stock) as unidades_hoy;

drop table if exists _rb_fuentes;
