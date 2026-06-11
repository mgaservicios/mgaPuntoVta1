ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS contacto   text,
  ADD COLUMN IF NOT EXISTS cod_postal text,
  ADD COLUMN IF NOT EXISTS provincia  text,
  ADD COLUMN IF NOT EXISTS pais       text NOT NULL DEFAULT 'ARGENTINA',
  ADD COLUMN IF NOT EXISTS tipo_iva   text;
