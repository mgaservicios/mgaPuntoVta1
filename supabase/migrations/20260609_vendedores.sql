-- Catálogo de vendedores (independiente de usuarios del sistema)
CREATE TABLE IF NOT EXISTS public.vendedores (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      text NOT NULL,
  sucursal_id bigint NOT NULL REFERENCES public.sucursales(id),
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ventas: reemplazar FK uuid→users por bigint→vendedores
ALTER TABLE public.ventas
  DROP CONSTRAINT ventas_vendedor_id_fkey,
  DROP COLUMN vendedor_id;
ALTER TABLE public.ventas
  ADD COLUMN vendedor_id bigint REFERENCES public.vendedores(id);

-- ordenes_venta: ídem
ALTER TABLE public.ordenes_venta
  DROP CONSTRAINT ordenes_venta_vendedor_id_fkey,
  DROP COLUMN vendedor_id;
ALTER TABLE public.ordenes_venta
  ADD COLUMN vendedor_id bigint REFERENCES public.vendedores(id);

-- optica_ordenes, optica_servicios, caja_sesiones, caja_movimientos, notas_credito: columna nueva
ALTER TABLE public.optica_ordenes
  ADD COLUMN IF NOT EXISTS vendedor_id bigint REFERENCES public.vendedores(id);
ALTER TABLE public.optica_servicios
  ADD COLUMN IF NOT EXISTS vendedor_id bigint REFERENCES public.vendedores(id);
ALTER TABLE public.caja_sesiones
  ADD COLUMN IF NOT EXISTS vendedor_id bigint REFERENCES public.vendedores(id);
ALTER TABLE public.caja_movimientos
  ADD COLUMN IF NOT EXISTS vendedor_id bigint REFERENCES public.vendedores(id);
ALTER TABLE public.notas_credito
  ADD COLUMN IF NOT EXISTS vendedor_id bigint REFERENCES public.vendedores(id);
ALTER TABLE public.remitos
  ADD COLUMN IF NOT EXISTS vendedor_id bigint REFERENCES public.vendedores(id);
