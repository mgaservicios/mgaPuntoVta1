-- Agrega campo categoria ('costo' | 'venta') a listas_precio
ALTER TABLE public.listas_precio
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'venta'
    CHECK (categoria IN ('costo', 'venta'));

-- Actualizar seed: Compra = costo, las de venta = venta
UPDATE public.listas_precio SET categoria = 'costo' WHERE nombre = 'Compra';
UPDATE public.listas_precio SET categoria = 'venta' WHERE nombre IN ('Venta Público', 'Venta Mayorista');
