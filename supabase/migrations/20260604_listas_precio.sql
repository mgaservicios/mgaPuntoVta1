-- ============================================================
-- LISTAS DE PRECIO Y HISTORIAL DE PRECIOS
-- ============================================================

-- Listas de precio (manual o calculada en base a otra lista)
CREATE TABLE IF NOT EXISTS public.listas_precio (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre          text NOT NULL UNIQUE,
  tipo            text NOT NULL DEFAULT 'manual'
                    CHECK (tipo IN ('manual', 'calculada')),
  lista_base_id   bigint REFERENCES public.listas_precio(id) ON DELETE SET NULL,
  porcentaje      numeric(8,4),
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Datos por defecto
INSERT INTO public.listas_precio (nombre, tipo) VALUES ('Compra', 'manual');

INSERT INTO public.listas_precio (nombre, tipo, lista_base_id, porcentaje)
VALUES (
  'Venta Público', 'calculada',
  (SELECT id FROM public.listas_precio WHERE nombre = 'Compra'),
  30
);

INSERT INTO public.listas_precio (nombre, tipo)
VALUES ('Venta Mayorista', 'manual');

-- Historial de precios por artículo/variante/lista
CREATE TABLE IF NOT EXISTS public.precios (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  articulo_id         bigint NOT NULL REFERENCES public.articulos(id) ON DELETE CASCADE,
  variante_id         bigint REFERENCES public.articulo_variantes(id) ON DELETE CASCADE,
  lista_precio_id     bigint NOT NULL REFERENCES public.listas_precio(id) ON DELETE CASCADE,
  precio              numeric(12,2) NOT NULL,
  vigente_desde       timestamptz NOT NULL DEFAULT now(),
  origen_tipo         text CHECK (origen_tipo IN ('manual', 'proveedor', 'sucursal', 'remito')),
  origen_proveedor_id bigint REFERENCES public.proveedores(id) ON DELETE SET NULL,
  origen_sucursal_id  bigint REFERENCES public.sucursales(id) ON DELETE SET NULL,
  remito_id           bigint REFERENCES public.remitos(id) ON DELETE SET NULL,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS precios_articulo_lista_idx
  ON public.precios (articulo_id, lista_precio_id, vigente_desde DESC);

CREATE INDEX IF NOT EXISTS precios_variante_lista_idx
  ON public.precios (variante_id, lista_precio_id, vigente_desde DESC)
  WHERE variante_id IS NOT NULL;

-- Migrar precios existentes de artículos a la nueva tabla
-- precio_compra → lista "Compra"
INSERT INTO public.precios (articulo_id, lista_precio_id, precio, origen_tipo, vigente_desde)
SELECT
  a.id,
  lp.id,
  a.precio_compra,
  'manual',
  a.created_at
FROM public.articulos a
CROSS JOIN public.listas_precio lp
WHERE a.precio_compra IS NOT NULL
  AND lp.nombre = 'Compra';

-- precio_venta → lista "Venta Público" (solo listas manuales que no sean calculadas)
-- Nota: si "Venta Público" es calculada, solo migramos si el precio difiere del calculado
-- Para simplificar, insertamos como historial aunque la lista sea calculada
INSERT INTO public.precios (articulo_id, lista_precio_id, precio, origen_tipo, vigente_desde)
SELECT
  a.id,
  lp.id,
  a.precio_venta,
  'manual',
  a.created_at
FROM public.articulos a
CROSS JOIN public.listas_precio lp
WHERE a.precio_venta IS NOT NULL
  AND lp.nombre = 'Venta Público';

-- Migrar precios de variantes también
INSERT INTO public.precios (articulo_id, variante_id, lista_precio_id, precio, origen_tipo, vigente_desde)
SELECT
  v.articulo_id,
  v.id,
  lp.id,
  v.precio_compra,
  'manual',
  v.created_at
FROM public.articulo_variantes v
CROSS JOIN public.listas_precio lp
WHERE v.precio_compra IS NOT NULL
  AND lp.nombre = 'Compra';

INSERT INTO public.precios (articulo_id, variante_id, lista_precio_id, precio, origen_tipo, vigente_desde)
SELECT
  v.articulo_id,
  v.id,
  lp.id,
  v.precio_venta,
  'manual',
  v.created_at
FROM public.articulo_variantes v
CROSS JOIN public.listas_precio lp
WHERE v.precio_venta IS NOT NULL
  AND lp.nombre = 'Venta Público';
