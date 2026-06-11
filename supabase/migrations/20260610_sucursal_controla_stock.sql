ALTER TABLE public.sucursales
  ADD COLUMN IF NOT EXISTS controla_stock boolean NOT NULL DEFAULT false;
