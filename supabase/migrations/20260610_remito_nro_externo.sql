-- Agrega campo para número de factura/remito externo del proveedor
ALTER TABLE public.remitos ADD COLUMN IF NOT EXISTS nro_externo TEXT;
