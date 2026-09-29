-- ═══════════════════════════════════════════════════════════════════════════
-- Referencias de origen en movimientos_stock + autor en ventas
-- ═══════════════════════════════════════════════════════════════════════════
-- Necesario para la reconstrucción de stock desde documentos
-- (supabase/stock_rebuild.sql).
--
-- 1. ventas.created_by: hoy public.ventas no guarda quién la creó, y
--    movimientos_stock.usuario_id es NOT NULL. Sin esta columna no se puede
--    regenerar el historial de las ventas POS con su autor real.
-- 2. movimientos_stock.*_id: hasta ahora un movimiento de remito, de orden de
--    venta o de OT solo se vinculaba a su documento por el texto de
--    `referencia` (el número). Con estas FKs el vínculo pasa a ser estructural
--    y el rebuild puede rellenarlo.
--
-- Idempotente: se puede correr más de una vez sin efectos.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Autor de la venta
-- ─────────────────────────────────────────────────────────────────────────────
-- Nullable a propósito: las ventas históricas no tienen autor conocido. El
-- rebuild usa un usuario admin como fallback para esas (ver
-- stock_rebuild.sql, parámetro admin_uuid).
alter table public.ventas
  add column if not exists created_by uuid references public.users(id);

comment on column public.ventas.created_by is
  'Usuario que creó la venta. NULL en ventas históricas anteriores a esta columna.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Vínculo estructural con el documento de origen
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.movimientos_stock
  add column if not exists remito_id       bigint references public.remitos(id)       on delete cascade,
  add column if not exists orden_venta_id  bigint references public.ordenes_venta(id)  on delete cascade,
  add column if not exists optica_orden_id bigint references public.optica_ordenes(id) on delete cascade;

comment on column public.movimientos_stock.remito_id is
  'Remito que originó el movimiento (entradas, salidas, ajustes, stock inicial).';
comment on column public.movimientos_stock.orden_venta_id is
  'Orden de venta que originó el movimiento.';
comment on column public.movimientos_stock.optica_orden_id is
  'Orden de trabajo de óptica que originó el movimiento.';

-- Índices parciales: la mayoría de los movimientos son de un solo tipo, así que
-- un índice sobre (columna) completo agrega tamaño sin aporta consultas.
create index if not exists movimientos_stock_remito_idx
  on public.movimientos_stock (remito_id)
  where remito_id is not null;

create index if not exists movimientos_stock_orden_venta_idx
  on public.movimientos_stock (orden_venta_id)
  where orden_venta_id is not null;

create index if not exists movimientos_stock_optica_orden_idx
  on public.movimientos_stock (optica_orden_id)
  where optica_orden_id is not null;

-- Índice de apoyo para el rebuild: recorre los documentos por orden cronológico.
create index if not exists remito_items_rebuild_idx
  on public.remito_items (remito_id, articulo_id);

create index if not exists venta_items_rebuild_idx
  on public.venta_items (venta_id, articulo_id);

create index if not exists orden_venta_items_rebuild_idx
  on public.orden_venta_items (orden_id, articulo_id);

create index if not exists optica_orden_items_rebuild_idx
  on public.optica_orden_items (orden_id, articulo_id);
