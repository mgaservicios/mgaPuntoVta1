CREATE TABLE IF NOT EXISTS public.parametros (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave       text NOT NULL UNIQUE,
  valor       text NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('booleano', 'numero', 'lista_precio')),
  descripcion text,
  updated_at  timestamptz DEFAULT now()
);

INSERT INTO public.parametros (clave, valor, tipo, descripcion) VALUES
  ('controla_stock',
   CASE WHEN EXISTS (SELECT 1 FROM sucursales WHERE controla_stock = true) THEN 'true' ELSE 'false' END,
   'booleano',
   'Impide movimientos que dejen stock negativo'),
  ('maneja_variantes', 'false', 'booleano',
   'Permite crear artículos con variantes (talle, color, etc.)'),
  ('cantidades_decimales', 'false', 'booleano',
   'Permite ingresar cantidades con decimales en ventas, órdenes y remitos'),
  ('lista_precio_defecto_id',
   COALESCE((SELECT id::text FROM listas_precio WHERE categoria = 'venta' AND activo = true ORDER BY id LIMIT 1), ''),
   'lista_precio',
   'Lista de precio seleccionada por defecto al abrir el POS')
ON CONFLICT (clave) DO NOTHING;
