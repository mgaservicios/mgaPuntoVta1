-- ═══════════════════════════════════════════════════════════════════════════
-- BACKFILL — Devoluciones de stock por ventas anuladas
-- ═══════════════════════════════════════════════════════════════════════════
-- Requisito: correr antes 20260929_stock_consistencia.sql (agrega el tipo
--             'anulacion_venta' al CHECK de movimientos_stock).
-- Verificar antes:  supabase/backfill_ventas_anulacion_reporte.sql
-- Aplicar en una transacción con un backup previo.
--
-- Qué hace: inserta el movimiento 'anulacion_venta' que falta por cada venta
-- anulada. NO modifica articulo_stock: el stock ya fue devuelto por el código
-- de anulación vigente en su momento; acá solo se completa el historial.
--
-- Decisiones:
--  - created_at = ventas.updated_at, que es la última escritura de la venta y
--    por lo tanto la anulación (no hay columna de "anulada_por" ni fecha propia).
--  - usuario_id = el del movimiento original. No hay registro de quién anuló.
--  - stock_antes/stock_despues = espejo exacto del movimiento original
--    (stock_antes ← stock_despues original, y al revés). Es el inverso
--    matemático del movimiento, no el stock real en la fecha de anulación: si
--    hubo otros movimientos entre medio la cadena no va a empatar. A partir de
--    la migración, las anulaciones nuevas sí se registran en el momento y
--    encadenan correctamente.
--  - Es idempotente: sólo procesa ventas con más salidas que reversas, y una
--    segunda corrida no encuentra nada pendiente.

begin;

insert into public.movimientos_stock (
  articulo_id,
  variante_id,
  sucursal_id,
  tipo,
  cantidad,
  stock_antes,
  stock_despues,
  venta_id,
  venta_item_id,
  referencia,
  observaciones,
  usuario_id,
  created_at
)
select
  m.articulo_id,
  m.variante_id,
  m.sucursal_id,
  'anulacion_venta',
  abs(m.cantidad),
  m.stock_despues,   -- el stock que había quedado tras la venta...
  m.stock_antes,     -- ...y el que había antes: la anulación lo restituye
  m.venta_id,
  m.venta_item_id,
  m.referencia,
  'Anulación venta (backfill histórico)',
  m.usuario_id,
  v.updated_at
from public.movimientos_stock m
join public.ventas v on v.id = m.venta_id
where v.estado = 'anulada'
  and m.tipo in ('venta', 'devolucion')
  -- sólo las ventas cuya reversa falta
  and not exists (
    select 1
    from public.movimientos_stock r
    where r.venta_id = m.venta_id
      and r.tipo = 'anulacion_venta'
      and r.articulo_id = m.articulo_id
      and r.variante_id is not distinct from m.variante_id
  );

-- Verificación dentro de la misma transacción:
-- debería devolver 0 filas.
--
-- select m.venta_id, v.numero, count(*) filter (where m.tipo in ('venta','devolucion')) as salidas,
--        count(*) filter (where m.tipo = 'anulacion_venta') as reversas
-- from public.movimientos_stock m
-- join public.ventas v on v.id = m.venta_id
-- where v.estado = 'anulada' and m.venta_id is not null
-- group by m.venta_id, v.numero
-- having count(*) filter (where m.tipo in ('venta','devolucion')) <>
--        count(*) filter (where m.tipo = 'anulacion_venta');

commit;
