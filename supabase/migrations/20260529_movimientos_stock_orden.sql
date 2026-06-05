-- Agrega 'orden' como tipo válido en movimientos_stock
-- para registrar descuentos/reversiones de órdenes de venta confirmadas
alter table public.movimientos_stock
  drop constraint if exists movimientos_stock_tipo_check;

alter table public.movimientos_stock
  add constraint movimientos_stock_tipo_check
  check (tipo in ('entrada','salida','ajuste','venta','devolucion','orden'));
