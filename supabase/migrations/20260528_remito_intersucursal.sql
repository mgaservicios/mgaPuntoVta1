-- Permite vincular un remito de entrada con el remito de salida que lo originó
-- (transferencias inter-sucursal automáticas)
alter table public.remitos
  add column if not exists remito_origen_id bigint references public.remitos(id);
