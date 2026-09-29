-- ═══════════════════════════════════════════════════════════════════════════
-- REPORTE (no modifica nada) — Backfill de anulaciones de venta
-- ═══════════════════════════════════════════════════════════════════════════
-- Correr ANTES de supabase/backfill_ventas_anulacion.sql
--
-- Contexto: hasta ahora, anular una venta devolvía el stock a articulo_stock
-- pero no registraba el movimiento inverso. El stock quedó siempre correcto;
-- lo que falta es el rastro en el historial (movimientos_stock). Por eso el
-- backfill es insert-only y NO toca articulo_stock.
--
-- Criterio: venta con estado 'anulada' que tenga movimientos de tipo
-- 'venta'/'devolucion' y no tenga su correspondiente 'anulacion_venta'.
-- El nombre de estado es 'anulada' (femenino), no 'anulado'.

with salidas as (
  select
    m.venta_id,
    count(*) filter (where m.tipo in ('venta', 'devolucion')) as n_salida,
    count(*) filter (where m.tipo = 'anulacion_venta')     as n_reversa
  from public.movimientos_stock m
  where m.venta_id is not null
  group by m.venta_id
)
select
  v.id,
  v.numero,
  v.sucursal_id,
  v.fecha          as fecha_venta,
  v.updated_at     as fecha_anulacion_aprox,
  s.n_salida       as movimientos_salida,
  s.n_reversa      as movimientos_reversa,
  s.n_salida - s.n_reversa as movimientos_a_insertar
from public.ventas v
join salidas s on s.venta_id = v.id
where v.estado = 'anulada'
  and s.n_salida > s.n_reversa          -- falta la reversa (o está incompleta)
order by v.updated_at;
