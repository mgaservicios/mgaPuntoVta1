-- ============================================================
-- MGA Pto. Venta — Schema completo (TENANT)
-- Incluye todas las migraciones hasta 2026-06-05
-- Ejecutar en Supabase SQL Editor sobre la BD del tenant
-- ============================================================

-- Extensión para búsqueda fuzzy
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- SUCURSALES (primero: muchas tablas la referencian)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sucursales (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     text NOT NULL,
  direccion  text,
  telefono   text,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE public.roles (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  description text,
  is_default  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX roles_is_default_true ON public.roles (is_default) WHERE is_default = true;

INSERT INTO public.roles (name, description, is_default) VALUES
  ('Administrador', 'Acceso total al sistema',       false),
  ('Supervisor',    'Reportes y gestión de stock',   false),
  ('Vendedor',      'Punto de venta',                true);

-- ============================================================
-- USUARIOS
-- ============================================================
CREATE TABLE public.users (
  id         uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email      text NOT NULL,
  name       text,
  role_id    bigint NOT NULL REFERENCES public.roles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_service_role_all" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- USUARIOS POR SUCURSAL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_sucursales (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid   NOT NULL REFERENCES public.users(id)      ON DELETE CASCADE,
  sucursal_id bigint NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  UNIQUE (user_id, sucursal_id)
);

-- ============================================================
-- PERMISOS POR ROL
-- ============================================================
CREATE TABLE public.role_permissions (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id    bigint NOT NULL REFERENCES public.roles(id),
  module     text NOT NULL,
  can_view   boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_edit   boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  UNIQUE (role_id, module)
);

-- Administrador: acceso total
INSERT INTO public.role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
SELECT 1, m, true, true, true, true
FROM unnest(ARRAY['articulos','ventas','stock','cobranzas','caja','clientes','proveedores','admin']) AS m;

-- Supervisor
INSERT INTO public.role_permissions (role_id, module, can_view, can_create, can_edit, can_delete) VALUES
  (2, 'articulos',   true,  false, false, false),
  (2, 'ventas',      true,  false, false, false),
  (2, 'stock',       true,  true,  true,  false),
  (2, 'cobranzas',   true,  false, false, false),
  (2, 'caja',        true,  false, false, false),
  (2, 'clientes',    true,  true,  true,  false),
  (2, 'proveedores', true,  false, false, false),
  (2, 'admin',       false, false, false, false);

-- Vendedor
INSERT INTO public.role_permissions (role_id, module, can_view, can_create, can_edit, can_delete) VALUES
  (3, 'articulos',   true,  false, false, false),
  (3, 'ventas',      true,  true,  false, false),
  (3, 'stock',       false, false, false, false),
  (3, 'cobranzas',   false, false, false, false),
  (3, 'caja',        true,  true,  false, false),
  (3, 'clientes',    true,  true,  false, false),
  (3, 'proveedores', false, false, false, false),
  (3, 'admin',       false, false, false, false);

-- ============================================================
-- CLIENTES
-- ============================================================
CREATE TABLE public.clientes (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     text NOT NULL,
  tipo       text NOT NULL DEFAULT 'PARTICULAR' CHECK (tipo IN ('PARTICULAR','EMPRESA','COMERCIO')),
  email      text,
  telefono   text,
  direccion  text,
  localidad  text,
  cuit       text,
  notas      text,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX clientes_nombre_idx ON public.clientes USING gin (nombre gin_trgm_ops);

-- ============================================================
-- PROVEEDORES
-- ============================================================
CREATE TABLE public.proveedores (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     text NOT NULL,
  cuit       text,
  telefono   text,
  email      text,
  direccion  text,
  localidad  text,
  notas      text,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- CATÁLOGOS
-- ============================================================
CREATE TABLE public.categorias (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     text NOT NULL UNIQUE,
  activo     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- [migración 20260529_subcategorias]
CREATE TABLE public.subcategorias (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre       text NOT NULL,
  categoria_id bigint NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  activo       boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (nombre, categoria_id)
);

CREATE TABLE public.marcas (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     text NOT NULL UNIQUE,
  activo     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.atributo_tipos (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     text NOT NULL UNIQUE,
  activo     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.atributo_tipos (nombre) VALUES
  ('Talle'), ('Color'), ('Tamaño'), ('Material');

-- ============================================================
-- ARTÍCULOS
-- [migración 20260529_subcategorias: columna subcategoria_id]
-- ============================================================
CREATE TABLE public.articulos (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo          text UNIQUE,
  nombre          text NOT NULL,
  descripcion     text,
  tipo_articulo   text NOT NULL DEFAULT 'simple' CHECK (tipo_articulo IN ('simple','con_variantes')),
  categoria_id    bigint REFERENCES public.categorias(id),
  subcategoria_id bigint REFERENCES public.subcategorias(id),
  marca_id        bigint REFERENCES public.marcas(id),
  proveedor_id    bigint REFERENCES public.proveedores(id),
  precio_venta    numeric(12,2),
  precio_compra   numeric(12,2),
  stock_actual    numeric(10,3) NOT NULL DEFAULT 0,
  stock_minimo    numeric(10,3) NOT NULL DEFAULT 0,
  unidad          text NOT NULL DEFAULT 'unidad'
                    CHECK (unidad IN ('unidad','kg','gr','lt','ml','caja','bolsa','metro','par')),
  codigo_barras   text UNIQUE,
  activo          boolean NOT NULL DEFAULT true,
  imagen_url      text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX articulos_nombre_trgm_idx ON public.articulos USING gin (nombre gin_trgm_ops);
CREATE INDEX articulos_codigo_idx      ON public.articulos (codigo) WHERE codigo IS NOT NULL;

-- Seed: categoría por defecto
INSERT INTO public.categorias (nombre) VALUES ('Varios') ON CONFLICT (nombre) DO NOTHING;

-- ============================================================
-- VARIANTES
-- ============================================================
CREATE TABLE public.articulo_variantes (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  articulo_id   bigint NOT NULL REFERENCES public.articulos(id) ON DELETE CASCADE,
  sku           text UNIQUE,
  codigo_barras text UNIQUE,
  precio_venta  numeric(12,2),
  precio_compra numeric(12,2),
  stock_actual  numeric(10,3) NOT NULL DEFAULT 0,
  stock_minimo  numeric(10,3) NOT NULL DEFAULT 0,
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX variantes_articulo_idx ON public.articulo_variantes (articulo_id);

CREATE TABLE public.variante_atributos (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  variante_id      bigint NOT NULL REFERENCES public.articulo_variantes(id) ON DELETE CASCADE,
  atributo_tipo_id bigint NOT NULL REFERENCES public.atributo_tipos(id),
  valor            text NOT NULL,
  UNIQUE (variante_id, atributo_tipo_id)
);
CREATE INDEX variante_atributos_variante_idx ON public.variante_atributos (variante_id);

-- ============================================================
-- STOCK POR SUCURSAL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.articulo_stock (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  articulo_id  bigint NOT NULL REFERENCES public.articulos(id)          ON DELETE CASCADE,
  variante_id  bigint          REFERENCES public.articulo_variantes(id) ON DELETE CASCADE,
  sucursal_id  bigint NOT NULL REFERENCES public.sucursales(id),
  stock_actual numeric(10,3) NOT NULL DEFAULT 0,
  stock_minimo numeric(10,3) NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS articulo_stock_simple_idx
  ON public.articulo_stock (articulo_id, sucursal_id)
  WHERE variante_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS articulo_stock_variante_idx
  ON public.articulo_stock (articulo_id, variante_id, sucursal_id)
  WHERE variante_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS articulo_stock_sucursal_idx ON public.articulo_stock (sucursal_id);

-- ============================================================
-- LISTAS DE PRECIO
-- [migración 20260604_listas_precio + 20260604_listas_precio_categoria]
-- ============================================================
CREATE TABLE IF NOT EXISTS public.listas_precio (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre        text NOT NULL UNIQUE,
  tipo          text NOT NULL DEFAULT 'manual'
                  CHECK (tipo IN ('manual', 'calculada')),
  categoria     text NOT NULL DEFAULT 'venta'
                  CHECK (categoria IN ('costo', 'venta')),
  lista_base_id bigint REFERENCES public.listas_precio(id) ON DELETE SET NULL,
  porcentaje    numeric(8,4),
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Seed: listas por defecto
INSERT INTO public.listas_precio (nombre, tipo, categoria) VALUES
  ('Compra', 'manual', 'costo');

INSERT INTO public.listas_precio (nombre, tipo, categoria, lista_base_id, porcentaje)
VALUES (
  'Venta Público', 'calculada', 'venta',
  (SELECT id FROM public.listas_precio WHERE nombre = 'Compra'),
  30
);

INSERT INTO public.listas_precio (nombre, tipo, categoria) VALUES
  ('Venta Mayorista', 'manual', 'venta');

-- ============================================================
-- CAJA
-- [migración 20260528_caja_sucursal: columna sucursal_id + índice por sucursal]
-- [migración 20260605_caja_tipo_concepto: columna tipo_concepto]
-- ============================================================
CREATE TABLE public.caja_sesiones (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id     uuid   NOT NULL REFERENCES public.users(id),
  sucursal_id    bigint REFERENCES public.sucursales(id),
  fecha_apertura timestamptz NOT NULL DEFAULT now(),
  monto_apertura numeric(12,2) NOT NULL DEFAULT 0,
  fecha_cierre   timestamptz,
  monto_cierre   numeric(12,2),
  monto_esperado numeric(12,2),
  diferencia     numeric(12,2),
  observaciones  text,
  estado         text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
  created_at     timestamptz DEFAULT now()
);
-- Una sola caja abierta por sucursal
CREATE UNIQUE INDEX caja_un_abierta_por_sucursal
  ON public.caja_sesiones (sucursal_id)
  WHERE estado = 'abierta';

CREATE TABLE public.caja_movimientos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sesion_id     bigint NOT NULL REFERENCES public.caja_sesiones(id),
  tipo          text NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  tipo_concepto text,
  concepto      text NOT NULL,
  monto         numeric(12,2) NOT NULL,
  usuario_id    uuid NOT NULL REFERENCES public.users(id),
  created_at    timestamptz DEFAULT now()
);

-- ============================================================
-- NOTAS DE CRÉDITO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notas_credito (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero           text NOT NULL UNIQUE,
  cliente_id       bigint NOT NULL REFERENCES public.clientes(id),
  fecha            date NOT NULL DEFAULT CURRENT_DATE,
  monto            numeric(12,2) NOT NULL CHECK (monto > 0),
  monto_disponible numeric(12,2) NOT NULL CHECK (monto_disponible >= 0),
  estado           text NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','utilizada','anulada')),
  observaciones    text,
  created_by       uuid NOT NULL REFERENCES public.users(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notas_credito_cliente_idx
  ON public.notas_credito (cliente_id, created_at DESC);

-- ============================================================
-- VENTAS / POS
-- ============================================================
CREATE TABLE public.ventas (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero          text NOT NULL UNIQUE,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  cliente_id      bigint REFERENCES public.clientes(id),
  vendedor_id     uuid   NOT NULL REFERENCES public.users(id),
  caja_sesion_id  bigint NOT NULL REFERENCES public.caja_sesiones(id),
  sucursal_id     bigint REFERENCES public.sucursales(id),
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  descuento_pct   numeric(5,2)  NOT NULL DEFAULT 0,
  descuento_monto numeric(12,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  estado          text NOT NULL DEFAULT 'completada' CHECK (estado IN ('completada','anulada')),
  observaciones   text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX ventas_fecha_idx       ON public.ventas (fecha DESC);
CREATE INDEX ventas_caja_sesion_idx ON public.ventas (caja_sesion_id);

CREATE TABLE public.venta_items (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venta_id             bigint NOT NULL REFERENCES public.ventas(id)              ON DELETE CASCADE,
  articulo_id          bigint NOT NULL REFERENCES public.articulos(id),
  variante_id          bigint          REFERENCES public.articulo_variantes(id),
  nombre_articulo      text NOT NULL,
  descripcion_variante text,
  cantidad             numeric(10,3) NOT NULL,
  precio_unitario      numeric(12,2) NOT NULL,
  descuento_pct        numeric(5,2)  NOT NULL DEFAULT 0,
  subtotal             numeric(12,2) NOT NULL,
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE public.venta_pagos (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venta_id        bigint NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  metodo          text NOT NULL
                    CHECK (metodo IN ('EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO','TARJETA_CREDITO',
                                      'CUENTA_CORRIENTE','NOTA_CREDITO','OTRO')),
  monto           numeric(12,2) NOT NULL,
  referencia      text,
  nota_credito_id bigint REFERENCES public.notas_credito(id),
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- MOVIMIENTOS DE STOCK
-- [migración 20260529_movimientos_stock_orden: agrega tipo 'orden']
-- ============================================================
CREATE TABLE public.movimientos_stock (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  articulo_id    bigint NOT NULL REFERENCES public.articulos(id),
  variante_id    bigint          REFERENCES public.articulo_variantes(id),
  tipo           text NOT NULL
                   CHECK (tipo IN ('entrada','salida','ajuste','venta','devolucion','orden')),
  cantidad       numeric(10,3) NOT NULL,
  costo_unitario numeric(12,2),
  stock_antes    numeric(10,3) NOT NULL,
  stock_despues  numeric(10,3) NOT NULL,
  venta_id       bigint REFERENCES public.ventas(id),
  venta_item_id  bigint REFERENCES public.venta_items(id),
  proveedor_id   bigint REFERENCES public.proveedores(id),
  sucursal_id    bigint REFERENCES public.sucursales(id),
  usuario_id     uuid NOT NULL REFERENCES public.users(id),
  referencia     text,
  observaciones  text,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX movimientos_stock_articulo_idx
  ON public.movimientos_stock (articulo_id, created_at DESC);

-- ============================================================
-- COBRANZAS
-- ============================================================
CREATE TABLE public.cobranzas (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id  bigint NOT NULL REFERENCES public.clientes(id),
  venta_id    bigint          REFERENCES public.ventas(id),
  tipo        text NOT NULL CHECK (tipo IN ('CARGO','PAGO')),
  monto       numeric(12,2) NOT NULL,
  fecha       date NOT NULL DEFAULT CURRENT_DATE,
  metodo      text CHECK (metodo IN ('EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO',
                                     'TARJETA_CREDITO','CHEQUE','OTRO')),
  descripcion text,
  notas       text,
  usuario_id  uuid NOT NULL REFERENCES public.users(id),
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX cobranzas_cliente_idx ON public.cobranzas (cliente_id, fecha DESC);
CREATE INDEX cobranzas_venta_idx   ON public.cobranzas (venta_id) WHERE venta_id IS NOT NULL;

-- ============================================================
-- ÓRDENES DE VENTA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ordenes_venta (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero          text NOT NULL UNIQUE,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  vencimiento     date,
  cliente_id      bigint REFERENCES public.clientes(id),
  vendedor_id     uuid   NOT NULL REFERENCES public.users(id),
  condicion_pago  text NOT NULL DEFAULT 'contado'
                    CHECK (condicion_pago IN ('contado','cuenta_corriente','otro')),
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  descuento_pct   numeric(5,2)  NOT NULL DEFAULT 0,
  descuento_monto numeric(12,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  estado          text NOT NULL DEFAULT 'borrador'
                    CHECK (estado IN ('borrador','confirmada','anulada')),
  sucursal_id     bigint REFERENCES public.sucursales(id),
  observaciones   text,
  created_by      uuid NOT NULL REFERENCES public.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ordenes_fecha_idx ON public.ordenes_venta (fecha DESC);

CREATE TABLE IF NOT EXISTS public.orden_venta_items (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id             bigint NOT NULL REFERENCES public.ordenes_venta(id)      ON DELETE CASCADE,
  articulo_id          bigint NOT NULL REFERENCES public.articulos(id),
  variante_id          bigint          REFERENCES public.articulo_variantes(id),
  nombre_articulo      text NOT NULL,
  descripcion_variante text,
  cantidad             numeric(10,3) NOT NULL,
  precio_unitario      numeric(12,2) NOT NULL,
  descuento_pct        numeric(5,2)  NOT NULL DEFAULT 0,
  subtotal             numeric(12,2) NOT NULL,
  created_at           timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orden_items_orden_idx ON public.orden_venta_items (orden_id);

CREATE TABLE IF NOT EXISTS public.orden_venta_pagos (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id        bigint NOT NULL REFERENCES public.ordenes_venta(id) ON DELETE CASCADE,
  metodo          text NOT NULL
                    CHECK (metodo IN ('EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO','TARJETA_CREDITO',
                                      'CUENTA_CORRIENTE','NOTA_CREDITO','CHEQUE','OTRO')),
  monto           numeric(12,2) NOT NULL,
  referencia      text,
  nota_credito_id bigint REFERENCES public.notas_credito(id),
  fecha_pago      date,
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- REMITOS
-- [migración 20260528_remito_intersucursal: columna remito_origen_id]
-- [migración 20260603_remito_precios_extras: columna precios_extras en items]
-- ============================================================
CREATE TABLE IF NOT EXISTS public.remitos (
  id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero                   text NOT NULL UNIQUE,
  tipo                     text NOT NULL CHECK (tipo IN ('entrada','salida')),
  sucursal_id              bigint NOT NULL REFERENCES public.sucursales(id),
  contraparte_tipo         text NOT NULL
                             CHECK (contraparte_tipo IN ('persona','proveedor','sucursal')),
  contraparte_nombre       text,
  contraparte_sucursal_id  bigint REFERENCES public.sucursales(id),
  contraparte_proveedor_id bigint REFERENCES public.proveedores(id),
  remito_origen_id         bigint REFERENCES public.remitos(id),
  fecha                    timestamptz NOT NULL DEFAULT now(),
  estado                   text NOT NULL DEFAULT 'borrador'
                             CHECK (estado IN ('borrador','confirmado','anulado')),
  observaciones            text,
  created_by               uuid NOT NULL REFERENCES public.users(id),
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS remitos_sucursal_idx ON public.remitos (sucursal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.remito_items (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  remito_id      bigint NOT NULL REFERENCES public.remitos(id)             ON DELETE CASCADE,
  articulo_id    bigint NOT NULL REFERENCES public.articulos(id),
  variante_id    bigint          REFERENCES public.articulo_variantes(id),
  cantidad       numeric(10,3) NOT NULL,
  costo_unitario numeric(12,2),
  precios_extras JSONB DEFAULT NULL,  -- [{"lista_precio_id": 3, "precio": 150.00}, ...]
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS remito_items_remito_idx ON public.remito_items (remito_id);

-- ============================================================
-- HISTORIAL DE PRECIOS
-- [migración 20260604_listas_precio]
-- ============================================================
CREATE TABLE IF NOT EXISTS public.precios (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  articulo_id         bigint NOT NULL REFERENCES public.articulos(id)          ON DELETE CASCADE,
  variante_id         bigint          REFERENCES public.articulo_variantes(id) ON DELETE CASCADE,
  lista_precio_id     bigint NOT NULL REFERENCES public.listas_precio(id)      ON DELETE CASCADE,
  precio              numeric(12,2) NOT NULL,
  vigente_desde       timestamptz NOT NULL DEFAULT now(),
  origen_tipo         text CHECK (origen_tipo IN ('manual', 'proveedor', 'sucursal', 'remito')),
  origen_proveedor_id bigint REFERENCES public.proveedores(id) ON DELETE SET NULL,
  origen_sucursal_id  bigint REFERENCES public.sucursales(id)  ON DELETE SET NULL,
  remito_id           bigint REFERENCES public.remitos(id)     ON DELETE SET NULL,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS precios_articulo_lista_idx
  ON public.precios (articulo_id, lista_precio_id, vigente_desde DESC);
CREATE INDEX IF NOT EXISTS precios_variante_lista_idx
  ON public.precios (variante_id, lista_precio_id, vigente_desde DESC)
  WHERE variante_id IS NOT NULL;

-- ============================================================
-- MÓDULO ÓPTICA — ÓRDENES DE TRABAJO
-- [migración 20260601_optica + 20260602_optica_costos + fixes]
-- ============================================================
CREATE TABLE optica_medicos (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     text NOT NULL,
  matricula  text,
  telefono   text,
  activo     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE optica_ordenes (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero          text NOT NULL UNIQUE,
  fecha           date DEFAULT CURRENT_DATE,
  fecha_prometida date,
  cliente_id      bigint REFERENCES clientes(id),
  medico_id       bigint REFERENCES optica_medicos(id),
  medico_nombre   text,
  receta_url      text,

  lejos_od_esfera   numeric(6,2),
  lejos_od_cilindro numeric(6,2),
  lejos_od_eje      smallint,
  lejos_oi_esfera   numeric(6,2),
  lejos_oi_cilindro numeric(6,2),
  lejos_oi_eje      smallint,

  cerca_od_esfera   numeric(6,2),
  cerca_od_cilindro numeric(6,2),
  cerca_od_eje      smallint,
  cerca_oi_esfera   numeric(6,2),
  cerca_oi_cilindro numeric(6,2),
  cerca_oi_eje      smallint,

  adicion numeric(4,2),
  dp      numeric(5,2),

  estado text DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','en_proceso','en_laboratorio','terminado','entregado','anulado')),

  pedido_a        text,
  observaciones   text,
  costo_trabajo   numeric(12,2) NOT NULL DEFAULT 0,
  anticipo        numeric(12,2) NOT NULL DEFAULT 0,
  subtotal        numeric(12,2) DEFAULT 0,
  descuento_pct   numeric(5,2)  DEFAULT 0,
  descuento_monto numeric(12,2) DEFAULT 0,
  total           numeric(12,2) DEFAULT 0,

  sucursal_id bigint REFERENCES sucursales(id),
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX ON optica_ordenes (fecha DESC);
CREATE INDEX ON optica_ordenes (cliente_id);
CREATE INDEX ON optica_ordenes (estado);

CREATE TABLE optica_orden_items (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id        bigint NOT NULL REFERENCES optica_ordenes(id) ON DELETE CASCADE,
  tipo            text NOT NULL
                    CHECK (tipo IN ('armazon','cristal','tratamiento','otro')),
  uso             text CHECK (uso IN ('lejos','cerca','ambos')),
  nombre          text NOT NULL,
  armazon_propio  boolean DEFAULT false,
  articulo_id     bigint REFERENCES articulos(id),
  variante_id     bigint REFERENCES articulo_variantes(id),
  cantidad        numeric(10,3) NOT NULL DEFAULT 1,
  precio_unitario numeric(12,2) NOT NULL DEFAULT 0,
  descuento_pct   numeric(5,2)  DEFAULT 0,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  notas           text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE optica_orden_tareas (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id           bigint NOT NULL REFERENCES optica_ordenes(id) ON DELETE CASCADE,
  titulo             text NOT NULL,
  descripcion        text,
  estado             text DEFAULT 'en_proceso'
                       CHECK (estado IN ('en_proceso','en_laboratorio','terminada')),
  fecha              date DEFAULT CURRENT_DATE,
  fecha_fin          date,
  usuario_id         uuid REFERENCES users(id),
  laboratorio_nombre text,
  laboratorio_tipo   text CHECK (laboratorio_tipo IN ('propio','externo')),
  created_by         uuid REFERENCES users(id),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
CREATE INDEX ON optica_orden_tareas (orden_id);

CREATE TABLE optica_orden_pagos (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id       bigint NOT NULL REFERENCES optica_ordenes(id) ON DELETE CASCADE,
  caja_sesion_id bigint REFERENCES caja_sesiones(id),
  metodo text NOT NULL
    CHECK (metodo IN ('EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO','TARJETA_CREDITO',
                      'CUENTA_CORRIENTE','CHEQUE','OTRO')),
  monto      numeric(12,2) NOT NULL,
  concepto   text,
  referencia text,
  fecha_pago date DEFAULT CURRENT_DATE,
  usuario_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON optica_orden_pagos (orden_id);

-- ============================================================
-- MÓDULO ÓPTICA — SERVICIOS / REPARACIONES
-- [migración optica_servicios.sql]
-- ============================================================
CREATE TABLE IF NOT EXISTS optica_servicios (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero          text UNIQUE NOT NULL,
  fecha           date DEFAULT CURRENT_DATE,
  fecha_prometida date,
  cliente_id      bigint REFERENCES clientes(id),
  costo_trabajo   numeric(12,2) DEFAULT 0,
  subtotal        numeric(12,2) DEFAULT 0,
  descuento_pct   numeric(5,2)  DEFAULT 0,
  descuento_monto numeric(12,2) DEFAULT 0,
  total           numeric(12,2) DEFAULT 0,
  anticipo        numeric(12,2) DEFAULT 0,
  detalle         text,
  observaciones   text,
  estado          text NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','en_proceso','terminado','entregado','anulado')),
  sucursal_id     bigint REFERENCES sucursales(id),
  created_by      uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS optica_servicio_tipos (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  servicio_id bigint NOT NULL REFERENCES optica_servicios(id) ON DELETE CASCADE,
  tipo        text NOT NULL
                CHECK (tipo IN (
                  'garantia','soldadura','patillas','plaquetas','terminales',
                  'tanza','cristales','embutir_bisgra','pase_armazon',
                  'cambio_cristales_sol_neutros','otros'
                )),
  detalle     text,
  precio      numeric(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS optica_servicio_tareas (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  servicio_id bigint NOT NULL REFERENCES optica_servicios(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  descripcion text,
  estado      text NOT NULL DEFAULT 'en_proceso'
                CHECK (estado IN ('en_proceso','terminada')),
  fecha       date,
  fecha_fin   date,
  usuario_id  uuid REFERENCES users(id),
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS optica_servicio_pagos (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  servicio_id    bigint NOT NULL REFERENCES optica_servicios(id) ON DELETE CASCADE,
  caja_sesion_id bigint REFERENCES caja_sesiones(id),
  metodo         text NOT NULL
                   CHECK (metodo IN (
                     'EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO',
                     'TARJETA_CREDITO','CUENTA_CORRIENTE','CHEQUE','OTRO'
                   )),
  monto       numeric(12,2) NOT NULL,
  concepto    text,
  referencia  text,
  fecha_pago  date DEFAULT CURRENT_DATE,
  usuario_id  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_optica_servicios_sucursal ON optica_servicios (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_optica_servicios_cliente  ON optica_servicios (cliente_id);
CREATE INDEX IF NOT EXISTS idx_optica_servicios_estado   ON optica_servicios (estado);
CREATE INDEX IF NOT EXISTS idx_optica_servicio_tipos_sv  ON optica_servicio_tipos (servicio_id);
CREATE INDEX IF NOT EXISTS idx_optica_servicio_tareas_sv ON optica_servicio_tareas (servicio_id);
CREATE INDEX IF NOT EXISTS idx_optica_servicio_pagos_sv  ON optica_servicio_pagos (servicio_id);

ALTER TABLE optica_servicios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE optica_servicio_tipos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE optica_servicio_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE optica_servicio_pagos  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_optica_servicios"
  ON optica_servicios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_optica_servicio_tipos"
  ON optica_servicio_tipos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_optica_servicio_tareas"
  ON optica_servicio_tareas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_optica_servicio_pagos"
  ON optica_servicio_pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- LOG DE ELIMINACIONES
-- [migración 20260603_eliminaciones_log]
-- ============================================================
CREATE TABLE IF NOT EXISTS public.eliminaciones_log (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo           text NOT NULL
                   CHECK (tipo IN ('optica_ot', 'orden_venta', 'venta', 'remito')),
  referencia_id  bigint NOT NULL,
  numero         text,
  cliente_nombre text,
  total          numeric(12,2),
  fecha_documento date,
  sucursal_id    bigint REFERENCES public.sucursales(id),
  estado_previo  text,
  usuario_id     uuid NOT NULL REFERENCES auth.users(id),
  datos_extra    jsonb,
  eliminado_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eliminaciones_log_tipo_idx
  ON public.eliminaciones_log (tipo, eliminado_at DESC);
CREATE INDEX IF NOT EXISTS eliminaciones_log_sucursal_idx
  ON public.eliminaciones_log (sucursal_id, eliminado_at DESC);
CREATE INDEX IF NOT EXISTS eliminaciones_log_usuario_idx
  ON public.eliminaciones_log (usuario_id, eliminado_at DESC);

-- ============================================================
-- FUNCIONES
-- ============================================================

-- Búsqueda fuzzy de artículos para POS y ajuste de stock
CREATE OR REPLACE FUNCTION buscar_articulos(p_query text, p_limit int DEFAULT 20)
RETURNS TABLE (
  id            bigint,
  codigo        text,
  nombre        text,
  tipo_articulo text,
  precio_venta  numeric,
  stock_actual  numeric,
  imagen_url    text
)
LANGUAGE sql STABLE AS $$
  SELECT a.id, a.codigo, a.nombre, a.tipo_articulo, a.precio_venta, a.stock_actual, a.imagen_url
  FROM public.articulos a
  WHERE a.activo = true
    AND (
      a.nombre          ILIKE '%' || p_query || '%'
      OR a.codigo       ILIKE '%' || p_query || '%'
      OR a.codigo_barras ILIKE '%' || p_query || '%'
      OR similarity(a.nombre, p_query) > 0.3
    )
  ORDER BY greatest(
    similarity(a.nombre, p_query),
    CASE WHEN a.codigo        ILIKE '%' || p_query || '%' THEN 0.9 ELSE 0 END,
    CASE WHEN a.codigo_barras = p_query                   THEN 1.0 ELSE 0 END
  ) DESC
  LIMIT p_limit;
$$;

-- Saldo de cliente (positivo = debe)
CREATE OR REPLACE FUNCTION saldo_cliente(p_cliente_id bigint)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    sum(CASE WHEN tipo = 'CARGO' THEN monto ELSE -monto END),
    0
  )
  FROM public.cobranzas
  WHERE cliente_id = p_cliente_id;
$$;

-- Monto esperado en caja al cierre
CREATE OR REPLACE FUNCTION caja_monto_esperado(p_sesion_id bigint)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT
    cs.monto_apertura
    + coalesce((
        SELECT sum(vp.monto)
        FROM public.venta_pagos vp
        JOIN public.ventas v ON v.id = vp.venta_id
        WHERE v.caja_sesion_id = p_sesion_id
          AND vp.metodo = 'EFECTIVO'
          AND v.estado  = 'completada'
      ), 0)
    + coalesce((
        SELECT sum(monto)
        FROM public.caja_movimientos
        WHERE sesion_id = p_sesion_id AND tipo = 'ingreso'
      ), 0)
    - coalesce((
        SELECT sum(monto)
        FROM public.caja_movimientos
        WHERE sesion_id = p_sesion_id AND tipo = 'egreso'
      ), 0)
  FROM public.caja_sesiones cs
  WHERE cs.id = p_sesion_id;
$$;
