-- Agrega sucursal_id a caja_sesiones para que cada sucursal tenga su propia caja
alter table public.caja_sesiones
  add column if not exists sucursal_id bigint references public.sucursales(id);

-- Reemplaza el índice único global (solo una caja abierta en todo el sistema)
-- por uno único por sucursal (una caja abierta por sucursal)
drop index if exists caja_un_abierta;
create unique index caja_un_abierta_por_sucursal
  on public.caja_sesiones (sucursal_id)
  where estado = 'abierta';
