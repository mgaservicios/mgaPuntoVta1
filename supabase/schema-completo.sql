-- ============================================================
-- MGA Pto. Venta (KOSKEN ERP) — Schema Tenant COMPLETO
-- Última actualización: 2026-06-13
-- Incluye todas las migraciones aplicadas hasta la fecha.
--
-- Ejecutar en Supabase SQL Editor sobre la BD del TENANT.
-- Orden de ejecución: este archivo único es suficiente.
-- ============================================================

-- ── Extensión fuzzy search ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ============================================================
-- SUCURSALES
-- (primera: muchas tablas la referencian)
-- Migraciones integradas: 20260609_sucursales_logo_color,
--                         20260610_sucursal_controla_stock
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sucursales (
  id             bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre         text    NOT NULL,
  direccion      text,
  telefono       text,
  activo         boolean NOT NULL DEFAULT true,
  logo_url       text,
  color          text,
  controla_stock boolean NOT NULL DEFAULT false,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);


-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE public.roles (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text   NOT NULL UNIQUE,
  description text,
  is_default  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX roles_is_default_true ON public.roles (is_default) WHERE is_default = true;

INSERT INTO public.roles (name, description, is_default) VALUES
  ('Administrador', 'Acceso total al sistema',     false),
  ('Supervisor',    'Reportes y gestión de stock', false),
  ('Vendedor',      'Punto de venta',              true);


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
CREATE POLICY "users_select_own"      ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_service_role_all" ON public.users FOR ALL    USING (auth.role() = 'service_role');


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
-- PERMISOS POR ROL  (modelo operation/allowed)
-- Migración: 20260610_role_permissions_v2
--            20260610_perm_ops_faltantes
-- ============================================================
CREATE TABLE public.role_permissions (
  id        bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id   bigint  NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  operation text    NOT NULL,
  allowed   boolean NOT NULL DEFAULT false,
  UNIQUE (role_id, operation)
);

-- ── Administrador (role_id = 1): todo permitido ──────────────
INSERT INTO public.role_permissions (role_id, operation, allowed)
SELECT 1, op, true FROM unnest(ARRAY[
  'ventas.pos.cobrar',
  'ventas.historial.ver','ventas.historial.anular',
  'ventas.ordenes.ver','ventas.ordenes.crear','ventas.ordenes.editar',
    'ventas.ordenes.confirmar','ventas.ordenes.anular',
  'ventas.clientes.ver','ventas.clientes.crear','ventas.clientes.editar','ventas.clientes.desactivar',
  'ventas.notas-credito.ver','ventas.notas-credito.crear','ventas.notas-credito.anular',
  'inventario.articulos.ver','inventario.articulos.crear',
    'inventario.articulos.editar','inventario.articulos.desactivar',
  'inventario.remitos.ver','inventario.remitos.crear',
    'inventario.remitos.confirmar','inventario.remitos.anular',
  'inventario.ajustes.ver','inventario.ajustes.aplicar',
  'inventario.proveedores.ver','inventario.proveedores.crear',
    'inventario.proveedores.editar','inventario.proveedores.desactivar',
  'consultas.stock.ver','consultas.seguimiento.ver','consultas.precios_costo.ver',
  'listados.cobranzas.ver','listados.ventas_articulos.ver','listados.precios.ver',
  'caja.caja.ver','caja.caja.abrir','caja.caja.cerrar','caja.caja.movimiento',
  'caja.cobranzas.ver',
  'optica.ordenes.ver','optica.ordenes.crear','optica.ordenes.editar',
    'optica.ordenes.cambiar-estado','optica.ordenes.pagar',
  'optica.medicos.ver','optica.medicos.crear','optica.medicos.editar','optica.medicos.eliminar',
  'optica.servicios.ver','optica.servicios.crear','optica.servicios.editar','optica.servicios.anular',
  'altas.marcas.ver','altas.marcas.crear','altas.marcas.editar','altas.marcas.eliminar',
  'altas.categorias.ver','altas.categorias.crear','altas.categorias.editar','altas.categorias.eliminar',
  'altas.subcategorias.ver','altas.subcategorias.crear','altas.subcategorias.editar','altas.subcategorias.eliminar',
  'altas.atributos.ver','altas.atributos.crear','altas.atributos.editar','altas.atributos.eliminar',
  'admin.usuarios.ver','admin.usuarios.crear','admin.usuarios.editar',
  'admin.roles.ver','admin.roles.crear','admin.roles.editar','admin.roles.eliminar',
  'admin.permisos.ver','admin.permisos.editar',
  'admin.sucursales.ver','admin.sucursales.crear','admin.sucursales.editar','admin.sucursales.eliminar',
  'admin.listas_precio.ver','admin.listas_precio.crear','admin.listas_precio.editar','admin.listas_precio.eliminar',
  'admin.vendedores.ver','admin.vendedores.crear','admin.vendedores.editar',
  'admin.formas_pago.ver','admin.formas_pago.crear','admin.formas_pago.editar','admin.formas_pago.eliminar'
]) AS op;

-- ── Supervisor (role_id = 2) ─────────────────────────────────
INSERT INTO public.role_permissions (role_id, operation, allowed) VALUES
  (2,'ventas.pos.cobrar',true),
  (2,'ventas.historial.ver',true),(2,'ventas.historial.anular',true),
  (2,'ventas.ordenes.ver',true),(2,'ventas.ordenes.crear',true),
    (2,'ventas.ordenes.editar',true),(2,'ventas.ordenes.confirmar',true),(2,'ventas.ordenes.anular',true),
  (2,'ventas.clientes.ver',true),(2,'ventas.clientes.crear',true),
    (2,'ventas.clientes.editar',true),(2,'ventas.clientes.desactivar',false),
  (2,'ventas.notas-credito.ver',true),(2,'ventas.notas-credito.crear',true),(2,'ventas.notas-credito.anular',false),
  (2,'inventario.articulos.ver',true),(2,'inventario.articulos.crear',false),
    (2,'inventario.articulos.editar',false),(2,'inventario.articulos.desactivar',false),
  (2,'inventario.remitos.ver',true),(2,'inventario.remitos.crear',true),
    (2,'inventario.remitos.confirmar',true),(2,'inventario.remitos.anular',false),
  (2,'inventario.ajustes.ver',true),(2,'inventario.ajustes.aplicar',true),
  (2,'inventario.proveedores.ver',true),(2,'inventario.proveedores.crear',false),
    (2,'inventario.proveedores.editar',false),(2,'inventario.proveedores.desactivar',false),
  (2,'consultas.stock.ver',true),(2,'consultas.seguimiento.ver',true),(2,'consultas.precios_costo.ver',true),
  (2,'listados.cobranzas.ver',true),(2,'listados.ventas_articulos.ver',true),(2,'listados.precios.ver',true),
  (2,'caja.caja.ver',true),(2,'caja.caja.abrir',true),(2,'caja.caja.cerrar',true),(2,'caja.caja.movimiento',true),
  (2,'caja.cobranzas.ver',true),
  (2,'optica.ordenes.ver',true),(2,'optica.ordenes.crear',true),(2,'optica.ordenes.editar',true),
    (2,'optica.ordenes.cambiar-estado',true),(2,'optica.ordenes.pagar',true),
  (2,'optica.medicos.ver',true),(2,'optica.medicos.crear',false),
    (2,'optica.medicos.editar',false),(2,'optica.medicos.eliminar',false),
  (2,'optica.servicios.ver',true),(2,'optica.servicios.crear',true),
    (2,'optica.servicios.editar',true),(2,'optica.servicios.anular',false),
  (2,'altas.marcas.ver',true),(2,'altas.marcas.crear',false),(2,'altas.marcas.editar',false),(2,'altas.marcas.eliminar',false),
  (2,'altas.categorias.ver',true),(2,'altas.categorias.crear',false),
    (2,'altas.categorias.editar',false),(2,'altas.categorias.eliminar',false),
  (2,'altas.subcategorias.ver',true),(2,'altas.subcategorias.crear',false),
    (2,'altas.subcategorias.editar',false),(2,'altas.subcategorias.eliminar',false),
  (2,'altas.atributos.ver',true),(2,'altas.atributos.crear',false),
    (2,'altas.atributos.editar',false),(2,'altas.atributos.eliminar',false),
  (2,'admin.usuarios.ver',false),(2,'admin.usuarios.crear',false),(2,'admin.usuarios.editar',false),
  (2,'admin.roles.ver',false),(2,'admin.roles.crear',false),(2,'admin.roles.editar',false),(2,'admin.roles.eliminar',false),
  (2,'admin.permisos.ver',false),(2,'admin.permisos.editar',false),
  (2,'admin.sucursales.ver',false),(2,'admin.sucursales.crear',false),
    (2,'admin.sucursales.editar',false),(2,'admin.sucursales.eliminar',false),
  (2,'admin.listas_precio.ver',false),(2,'admin.listas_precio.crear',false),
    (2,'admin.listas_precio.editar',false),(2,'admin.listas_precio.eliminar',false),
  (2,'admin.vendedores.ver',false),(2,'admin.vendedores.crear',false),(2,'admin.vendedores.editar',false),
  (2,'admin.formas_pago.ver',false),(2,'admin.formas_pago.crear',false),
    (2,'admin.formas_pago.editar',false),(2,'admin.formas_pago.eliminar',false);

-- ── Vendedor (role_id = 3) ───────────────────────────────────
INSERT INTO public.role_permissions (role_id, operation, allowed) VALUES
  (3,'ventas.pos.cobrar',true),
  (3,'ventas.historial.ver',true),(3,'ventas.historial.anular',false),
  (3,'ventas.ordenes.ver',true),(3,'ventas.ordenes.crear',true),
    (3,'ventas.ordenes.editar',false),(3,'ventas.ordenes.confirmar',false),(3,'ventas.ordenes.anular',false),
  (3,'ventas.clientes.ver',true),(3,'ventas.clientes.crear',true),
    (3,'ventas.clientes.editar',false),(3,'ventas.clientes.desactivar',false),
  (3,'ventas.notas-credito.ver',false),(3,'ventas.notas-credito.crear',false),(3,'ventas.notas-credito.anular',false),
  (3,'inventario.articulos.ver',true),(3,'inventario.articulos.crear',false),
    (3,'inventario.articulos.editar',false),(3,'inventario.articulos.desactivar',false),
  (3,'inventario.remitos.ver',false),(3,'inventario.remitos.crear',false),
    (3,'inventario.remitos.confirmar',false),(3,'inventario.remitos.anular',false),
  (3,'inventario.ajustes.ver',false),(3,'inventario.ajustes.aplicar',false),
  (3,'inventario.proveedores.ver',false),(3,'inventario.proveedores.crear',false),
    (3,'inventario.proveedores.editar',false),(3,'inventario.proveedores.desactivar',false),
  (3,'consultas.stock.ver',true),(3,'consultas.seguimiento.ver',false),(3,'consultas.precios_costo.ver',false),
  (3,'listados.cobranzas.ver',false),(3,'listados.ventas_articulos.ver',false),(3,'listados.precios.ver',false),
  (3,'caja.caja.ver',true),(3,'caja.caja.abrir',true),(3,'caja.caja.cerrar',false),(3,'caja.caja.movimiento',false),
  (3,'caja.cobranzas.ver',false),
  (3,'optica.ordenes.ver',true),(3,'optica.ordenes.crear',true),(3,'optica.ordenes.editar',false),
    (3,'optica.ordenes.cambiar-estado',false),(3,'optica.ordenes.pagar',true),
  (3,'optica.medicos.ver',true),(3,'optica.medicos.crear',false),
    (3,'optica.medicos.editar',false),(3,'optica.medicos.eliminar',false),
  (3,'optica.servicios.ver',true),(3,'optica.servicios.crear',true),
    (3,'optica.servicios.editar',false),(3,'optica.servicios.anular',false),
  (3,'altas.marcas.ver',false),(3,'altas.marcas.crear',false),(3,'altas.marcas.editar',false),(3,'altas.marcas.eliminar',false),
  (3,'altas.categorias.ver',false),(3,'altas.categorias.crear',false),
    (3,'altas.categorias.editar',false),(3,'altas.categorias.eliminar',false),
  (3,'altas.subcategorias.ver',false),(3,'altas.subcategorias.crear',false),
    (3,'altas.subcategorias.editar',false),(3,'altas.subcategorias.eliminar',false),
  (3,'altas.atributos.ver',false),(3,'altas.atributos.crear',false),
    (3,'altas.atributos.editar',false),(3,'altas.atributos.eliminar',false),
  (3,'admin.usuarios.ver',false),(3,'admin.usuarios.crear',false),(3,'admin.usuarios.editar',false),
  (3,'admin.roles.ver',false),(3,'admin.roles.crear',false),(3,'admin.roles.editar',false),(3,'admin.roles.eliminar',false),
  (3,'admin.permisos.ver',false),(3,'admin.permisos.editar',false),
  (3,'admin.sucursales.ver',false),(3,'admin.sucursales.crear',false),
    (3,'admin.sucursales.editar',false),(3,'admin.sucursales.eliminar',false),
  (3,'admin.listas_precio.ver',false),(3,'admin.listas_precio.crear',false),
    (3,'admin.listas_precio.editar',false),(3,'admin.listas_precio.eliminar',false),
  (3,'admin.vendedores.ver',false),(3,'admin.vendedores.crear',false),(3,'admin.vendedores.editar',false),
  (3,'admin.formas_pago.ver',false),(3,'admin.formas_pago.crear',false),
    (3,'admin.formas_pago.editar',false),(3,'admin.formas_pago.eliminar',false);


-- ============================================================
-- CLIENTES
-- ============================================================
CREATE TABLE public.clientes (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     text NOT NULL,
  tipo       text NOT NULL DEFAULT 'PARTICULAR'
               CHECK (tipo IN ('PARTICULAR','EMPRESA','COMERCIO')),
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
-- Migraciones integradas: 20260611_proveedores_campos_importacion,
--                         20260611_proveedores_id_by_default
-- ============================================================
CREATE TABLE public.proveedores (
  id         bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  nombre     text NOT NULL,
  cuit       text,
  telefono   text,
  email      text,
  direccion  text,
  localidad  text,
  cod_postal text,
  provincia  text,
  pais       text NOT NULL DEFAULT 'ARGENTINA',
  tipo_iva   text,
  contacto   text,
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

-- Migración: 20260529_subcategorias
CREATE TABLE public.subcategorias (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre       text   NOT NULL,
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

-- Migración: 20260608_unidades_medida
CREATE TABLE public.unidades_medida (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     text    NOT NULL UNIQUE,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
INSERT INTO public.unidades_medida (nombre) VALUES
  ('Unidad'),('Kg'),('Gr'),('Lt'),('Ml'),('Caja'),('Bolsa'),('Metro'),('Par');

INSERT INTO public.categorias (nombre) VALUES ('Varios') ON CONFLICT (nombre) DO NOTHING;


-- ============================================================
-- ARTÍCULOS
-- Migraciones integradas: 20260529_subcategorias (subcategoria_id),
--                         20260608_unidades_medida (unidad_id, drop unidad)
-- ============================================================
CREATE TABLE public.articulos (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo          text UNIQUE,
  nombre          text NOT NULL,
  descripcion     text,
  tipo_articulo   text NOT NULL DEFAULT 'simple'
                    CHECK (tipo_articulo IN ('simple','con_variantes')),
  categoria_id    bigint REFERENCES public.categorias(id),
  subcategoria_id bigint REFERENCES public.subcategorias(id),
  marca_id        bigint REFERENCES public.marcas(id),
  proveedor_id    bigint REFERENCES public.proveedores(id),
  unidad_id       bigint REFERENCES public.unidades_medida(id),
  precio_venta    numeric(12,2),
  precio_compra   numeric(12,2),
  stock_actual    numeric(10,3) NOT NULL DEFAULT 0,
  stock_minimo    numeric(10,3) NOT NULL DEFAULT 0,
  codigo_barras   text UNIQUE,
  activo          boolean NOT NULL DEFAULT true,
  imagen_url      text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX articulos_nombre_trgm_idx ON public.articulos USING gin (nombre gin_trgm_ops);
CREATE INDEX articulos_codigo_idx      ON public.articulos (codigo) WHERE codigo IS NOT NULL;


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
CREATE UNIQUE INDEX articulo_stock_simple_idx
  ON public.articulo_stock (articulo_id, sucursal_id)
  WHERE variante_id IS NULL;
CREATE UNIQUE INDEX articulo_stock_variante_idx
  ON public.articulo_stock (articulo_id, variante_id, sucursal_id)
  WHERE variante_id IS NOT NULL;
CREATE INDEX articulo_stock_sucursal_idx ON public.articulo_stock (sucursal_id);


-- ============================================================
-- LISTAS DE PRECIO
-- Migración: 20260604_listas_precio + 20260604_listas_precio_categoria
-- ============================================================
CREATE TABLE IF NOT EXISTS public.listas_precio (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre        text   NOT NULL UNIQUE,
  tipo          text   NOT NULL DEFAULT 'manual'
                  CHECK (tipo IN ('manual','calculada')),
  categoria     text   NOT NULL DEFAULT 'venta'
                  CHECK (categoria IN ('costo','venta')),
  lista_base_id bigint REFERENCES public.listas_precio(id) ON DELETE SET NULL,
  porcentaje    numeric(8,4),
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

INSERT INTO public.listas_precio (nombre, tipo, categoria) VALUES
  ('Compra', 'manual', 'costo');
INSERT INTO public.listas_precio (nombre, tipo, categoria, lista_base_id, porcentaje)
VALUES (
  'Venta Público', 'calculada', 'venta',
  (SELECT id FROM public.listas_precio WHERE nombre = 'Compra'), 30
);
INSERT INTO public.listas_precio (nombre, tipo, categoria) VALUES
  ('Venta Mayorista', 'manual', 'venta');


-- ============================================================
-- HISTORIAL DE PRECIOS
-- Migración: 20260604_listas_precio, 20260610_precio_lotes (lote_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.precios (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  articulo_id         bigint NOT NULL REFERENCES public.articulos(id)          ON DELETE CASCADE,
  variante_id         bigint          REFERENCES public.articulo_variantes(id) ON DELETE CASCADE,
  lista_precio_id     bigint NOT NULL REFERENCES public.listas_precio(id)      ON DELETE CASCADE,
  precio              numeric(12,2) NOT NULL,
  vigente_desde       timestamptz NOT NULL DEFAULT now(),
  lote_id             uuid,
  origen_tipo         text CHECK (origen_tipo IN ('manual','proveedor','sucursal','remito')),
  origen_proveedor_id bigint REFERENCES public.proveedores(id) ON DELETE SET NULL,
  origen_sucursal_id  bigint REFERENCES public.sucursales(id)  ON DELETE SET NULL,
  remito_id           bigint,  -- FK a remitos (se agrega abajo luego de crear la tabla)
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX precios_articulo_lista_idx
  ON public.precios (articulo_id, lista_precio_id, vigente_desde DESC);
CREATE INDEX precios_variante_lista_idx
  ON public.precios (variante_id, lista_precio_id, vigente_desde DESC)
  WHERE variante_id IS NOT NULL;
CREATE INDEX idx_precios_lote_id ON public.precios (lote_id);


-- ============================================================
-- LOTES DE ACTUALIZACIÓN MASIVA DE PRECIOS
-- Migración: 20260610_precio_lotes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.precio_lotes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_precio_id integer     NOT NULL,
  lista_nombre    text        NOT NULL,
  vigente_desde   date        NOT NULL,
  porcentaje      numeric(10,4) NOT NULL,
  signo           text        NOT NULL CHECK (signo IN ('aumento','descuento')),
  items_count     integer     NOT NULL DEFAULT 0,
  estado          text        NOT NULL DEFAULT 'aplicado'
                    CHECK (estado IN ('aplicado','revertido')),
  revertido_at    timestamptz,
  revertido_by    uuid,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_precio_lotes_created ON public.precio_lotes (created_at DESC);


-- ============================================================
-- FORMAS DE PAGO
-- Migración: 20260611_formas_pago
-- ============================================================
CREATE TABLE IF NOT EXISTS public.formas_pago (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     text    NOT NULL,
  tipo       text    NOT NULL
               CHECK (tipo IN ('TARJETA_CREDITO','TARJETA_DEBITO','BANCARIA','BILLETERA','MONEDA')),
  activo     boolean NOT NULL DEFAULT true,
  orden      int     NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.formas_pago_cuotas (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  forma_pago_id   bigint NOT NULL REFERENCES public.formas_pago(id) ON DELETE CASCADE,
  cantidad_cuotas int    NOT NULL CHECK (cantidad_cuotas >= 1),
  recargo_pct     numeric(5,2) NOT NULL DEFAULT 0,
  UNIQUE (forma_pago_id, cantidad_cuotas)
);

INSERT INTO public.formas_pago (nombre, tipo, orden) VALUES
  ('Efectivo',        'MONEDA',         1),
  ('Transferencia',   'BANCARIA',       2),
  ('Cheque',          'BANCARIA',       3),
  ('Tarjeta Débito',  'TARJETA_DEBITO', 4),
  ('Tarjeta Crédito', 'TARJETA_CREDITO',5)
ON CONFLICT DO NOTHING;


-- ============================================================
-- VENDEDORES
-- Migración: 20260609_vendedores
-- (catálogo independiente de los usuarios del sistema)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendedores (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      text   NOT NULL,
  sucursal_id bigint NOT NULL REFERENCES public.sucursales(id),
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);


-- ============================================================
-- CAJA
-- Migraciones: 20260528_caja_sucursal, 20260605_caja_tipo_concepto,
--              20260609_vendedores (vendedor_id)
-- ============================================================
CREATE TABLE public.caja_sesiones (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id     uuid   NOT NULL REFERENCES public.users(id),
  sucursal_id    bigint REFERENCES public.sucursales(id),
  vendedor_id    bigint REFERENCES public.vendedores(id),
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
  tipo          text   NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  tipo_concepto text,
  concepto      text   NOT NULL,
  monto         numeric(12,2) NOT NULL,
  usuario_id    uuid   NOT NULL REFERENCES public.users(id),
  vendedor_id   bigint REFERENCES public.vendedores(id),
  created_at    timestamptz DEFAULT now()
);


-- ============================================================
-- NOTAS DE CRÉDITO
-- Migración: 20260609_vendedores (vendedor_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notas_credito (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero           text   NOT NULL UNIQUE,
  cliente_id       bigint NOT NULL REFERENCES public.clientes(id),
  fecha            date   NOT NULL DEFAULT CURRENT_DATE,
  monto            numeric(12,2) NOT NULL CHECK (monto > 0),
  monto_disponible numeric(12,2) NOT NULL CHECK (monto_disponible >= 0),
  estado           text   NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','utilizada','anulada')),
  observaciones    text,
  vendedor_id      bigint REFERENCES public.vendedores(id),
  created_by       uuid   NOT NULL REFERENCES public.users(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX notas_credito_cliente_idx ON public.notas_credito (cliente_id, created_at DESC);


-- ============================================================
-- VENTAS / POS
-- Migraciones: 20260609_vendedores (vendedor_id → bigint),
--              20260611_formas_pago (forma_pago_id, cuotas, fecha_pago en pagos),
--              20260612_recargo (recargo_monto)
-- ============================================================
CREATE TABLE public.ventas (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero          text   NOT NULL UNIQUE,
  fecha           date   NOT NULL DEFAULT CURRENT_DATE,
  cliente_id      bigint REFERENCES public.clientes(id),
  vendedor_id     bigint REFERENCES public.vendedores(id),
  caja_sesion_id  bigint NOT NULL REFERENCES public.caja_sesiones(id),
  sucursal_id     bigint REFERENCES public.sucursales(id),
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  descuento_pct   numeric(5,2)  NOT NULL DEFAULT 0,
  descuento_monto numeric(12,2) NOT NULL DEFAULT 0,
  recargo_monto   numeric(10,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  estado          text NOT NULL DEFAULT 'completada'
                    CHECK (estado IN ('completada','anulada')),
  observaciones   text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX ventas_fecha_idx       ON public.ventas (fecha DESC);
CREATE INDEX ventas_caja_sesion_idx ON public.ventas (caja_sesion_id);

CREATE TABLE public.venta_items (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venta_id             bigint NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  articulo_id          bigint NOT NULL REFERENCES public.articulos(id),
  variante_id          bigint REFERENCES public.articulo_variantes(id),
  nombre_articulo      text   NOT NULL,
  descripcion_variante text,
  cantidad             numeric(10,3) NOT NULL,
  precio_unitario      numeric(12,2) NOT NULL,
  descuento_pct        numeric(5,2)  NOT NULL DEFAULT 0,
  subtotal             numeric(12,2) NOT NULL,
  created_at           timestamptz DEFAULT now()
);

-- Nota: CHECK de metodo eliminado (texto libre para formas_pago personalizadas)
CREATE TABLE public.venta_pagos (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venta_id        bigint NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  metodo          text   NOT NULL,
  monto           numeric(12,2) NOT NULL,
  referencia      text,
  nota_credito_id bigint REFERENCES public.notas_credito(id),
  forma_pago_id   bigint REFERENCES public.formas_pago(id),
  cuotas          int,
  fecha_pago      date,
  created_at      timestamptz DEFAULT now()
);


-- ============================================================
-- MOVIMIENTOS DE STOCK
-- Migración: 20260529_movimientos_stock_orden (tipo 'orden')
-- ============================================================
CREATE TABLE public.movimientos_stock (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  articulo_id    bigint NOT NULL REFERENCES public.articulos(id),
  variante_id    bigint REFERENCES public.articulo_variantes(id),
  tipo           text   NOT NULL
                   CHECK (tipo IN ('entrada','salida','ajuste','venta','devolucion','orden')),
  cantidad       numeric(10,3) NOT NULL,
  costo_unitario numeric(12,2),
  stock_antes    numeric(10,3) NOT NULL,
  stock_despues  numeric(10,3) NOT NULL,
  venta_id       bigint REFERENCES public.ventas(id),
  venta_item_id  bigint REFERENCES public.venta_items(id),
  proveedor_id   bigint REFERENCES public.proveedores(id),
  sucursal_id    bigint REFERENCES public.sucursales(id),
  usuario_id     uuid   NOT NULL REFERENCES public.users(id),
  referencia     text,
  observaciones  text,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX movimientos_stock_articulo_idx
  ON public.movimientos_stock (articulo_id, created_at DESC);


-- ============================================================
-- COBRANZAS (cuenta corriente)
-- Migraciones: 20260609_cobranzas_refs, 20260609_cobranzas_sucursal
-- ============================================================
CREATE TABLE public.cobranzas (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id          bigint NOT NULL REFERENCES public.clientes(id),
  venta_id            bigint REFERENCES public.ventas(id),
  orden_id            bigint,  -- FK a ordenes_venta (se agrega abajo)
  optica_orden_id     bigint,  -- FK a optica_ordenes (se agrega abajo)
  optica_servicio_id  bigint,  -- FK a optica_servicios (se agrega abajo)
  tipo                text   NOT NULL CHECK (tipo IN ('CARGO','PAGO')),
  monto               numeric(12,2) NOT NULL,
  fecha               date   NOT NULL DEFAULT CURRENT_DATE,
  metodo              text CHECK (metodo IN ('EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO',
                                             'TARJETA_CREDITO','CHEQUE','OTRO')),
  descripcion         text,
  notas               text,
  sucursal_id         bigint REFERENCES public.sucursales(id),
  usuario_id          uuid   NOT NULL REFERENCES public.users(id),
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX cobranzas_cliente_idx ON public.cobranzas (cliente_id, fecha DESC);
CREATE INDEX cobranzas_venta_idx   ON public.cobranzas (venta_id) WHERE venta_id IS NOT NULL;
CREATE INDEX idx_cobranzas_sucursal_id ON public.cobranzas (sucursal_id);


-- ============================================================
-- ÓRDENES DE VENTA
-- Migraciones: 20260609_vendedores (vendedor_id → bigint),
--              20260612_recargo (recargo_monto)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ordenes_venta (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero          text   NOT NULL UNIQUE,
  fecha           date   NOT NULL DEFAULT CURRENT_DATE,
  vencimiento     date,
  cliente_id      bigint REFERENCES public.clientes(id),
  vendedor_id     bigint REFERENCES public.vendedores(id),
  condicion_pago  text   NOT NULL DEFAULT 'contado'
                    CHECK (condicion_pago IN ('contado','cuenta_corriente','otro')),
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  descuento_pct   numeric(5,2)  NOT NULL DEFAULT 0,
  descuento_monto numeric(12,2) NOT NULL DEFAULT 0,
  recargo_monto   numeric(10,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  estado          text   NOT NULL DEFAULT 'borrador'
                    CHECK (estado IN ('borrador','confirmada','anulada')),
  sucursal_id     bigint REFERENCES public.sucursales(id),
  observaciones   text,
  created_by      uuid   NOT NULL REFERENCES public.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX ordenes_fecha_idx ON public.ordenes_venta (fecha DESC);

CREATE TABLE IF NOT EXISTS public.orden_venta_items (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id             bigint NOT NULL REFERENCES public.ordenes_venta(id) ON DELETE CASCADE,
  articulo_id          bigint NOT NULL REFERENCES public.articulos(id),
  variante_id          bigint REFERENCES public.articulo_variantes(id),
  nombre_articulo      text   NOT NULL,
  descripcion_variante text,
  cantidad             numeric(10,3) NOT NULL,
  precio_unitario      numeric(12,2) NOT NULL,
  descuento_pct        numeric(5,2)  NOT NULL DEFAULT 0,
  subtotal             numeric(12,2) NOT NULL,
  created_at           timestamptz DEFAULT now()
);
CREATE INDEX orden_items_orden_idx ON public.orden_venta_items (orden_id);

-- Nota: CHECK de metodo eliminado (texto libre para formas_pago personalizadas)
CREATE TABLE IF NOT EXISTS public.orden_venta_pagos (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id        bigint NOT NULL REFERENCES public.ordenes_venta(id) ON DELETE CASCADE,
  metodo          text   NOT NULL,
  monto           numeric(12,2) NOT NULL,
  referencia      text,
  nota_credito_id bigint REFERENCES public.notas_credito(id),
  forma_pago_id   bigint REFERENCES public.formas_pago(id),
  cuotas          int,
  fecha_pago      date,
  created_at      timestamptz DEFAULT now()
);


-- ============================================================
-- REMITOS
-- Migraciones: 20260528_remito_intersucursal (remito_origen_id),
--              20260603_remito_precios_extras (precios_extras),
--              20260609_vendedores (vendedor_id),
--              20260610_remito_nro_externo (nro_externo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.remitos (
  id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero                   text   NOT NULL UNIQUE,
  tipo                     text   NOT NULL CHECK (tipo IN ('entrada','salida')),
  sucursal_id              bigint NOT NULL REFERENCES public.sucursales(id),
  contraparte_tipo         text   NOT NULL
                             CHECK (contraparte_tipo IN ('persona','proveedor','sucursal')),
  contraparte_nombre       text,
  contraparte_sucursal_id  bigint REFERENCES public.sucursales(id),
  contraparte_proveedor_id bigint REFERENCES public.proveedores(id),
  remito_origen_id         bigint REFERENCES public.remitos(id),
  nro_externo              text,
  fecha                    timestamptz NOT NULL DEFAULT now(),
  estado                   text   NOT NULL DEFAULT 'borrador'
                             CHECK (estado IN ('borrador','confirmado','anulado')),
  observaciones            text,
  vendedor_id              bigint REFERENCES public.vendedores(id),
  created_by               uuid   NOT NULL REFERENCES public.users(id),
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);
CREATE INDEX remitos_sucursal_idx ON public.remitos (sucursal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.remito_items (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  remito_id      bigint NOT NULL REFERENCES public.remitos(id) ON DELETE CASCADE,
  articulo_id    bigint NOT NULL REFERENCES public.articulos(id),
  variante_id    bigint REFERENCES public.articulo_variantes(id),
  cantidad       numeric(10,3) NOT NULL,
  costo_unitario numeric(12,2),
  precios_extras JSONB DEFAULT NULL,  -- [{"lista_precio_id": 3, "precio": 150.00}, ...]
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX remito_items_remito_idx ON public.remito_items (remito_id);

-- FK diferida: precios.remito_id → remitos
ALTER TABLE public.precios
  ADD CONSTRAINT precios_remito_id_fkey
  FOREIGN KEY (remito_id) REFERENCES public.remitos(id) ON DELETE SET NULL;

-- FK diferidas: cobranzas → ordenes_venta / optica_ordenes / optica_servicios
-- (se completan abajo luego de crear las tablas de óptica)


-- ============================================================
-- MÓDULO ÓPTICA — MÉDICOS
-- ============================================================
CREATE TABLE public.optica_medicos (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     text   NOT NULL,
  matricula  text,
  telefono   text,
  activo     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);


-- ============================================================
-- MÓDULO ÓPTICA — ÓRDENES DE TRABAJO
-- Migraciones: 20260601_optica, 20260602_optica_costos,
--              20260602_optica_fix_columns, 20260602_optica_fix_tipo_check,
--              20260609_vendedores (vendedor_id),
--              20260612_recargo (recargo_monto)
-- ============================================================
CREATE TABLE public.optica_ordenes (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero          text   NOT NULL UNIQUE,
  fecha           date   DEFAULT CURRENT_DATE,
  fecha_prometida date,
  cliente_id      bigint REFERENCES public.clientes(id),
  medico_id       bigint REFERENCES public.optica_medicos(id),
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
  recargo_monto   numeric(10,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) DEFAULT 0,

  vendedor_id bigint REFERENCES public.vendedores(id),
  sucursal_id bigint REFERENCES public.sucursales(id),
  created_by  uuid   NOT NULL REFERENCES public.users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX ON public.optica_ordenes (fecha DESC);
CREATE INDEX ON public.optica_ordenes (cliente_id);
CREATE INDEX ON public.optica_ordenes (estado);

CREATE TABLE public.optica_orden_items (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id        bigint NOT NULL REFERENCES public.optica_ordenes(id) ON DELETE CASCADE,
  tipo            text   NOT NULL
                    CHECK (tipo IN ('armazon','cristal','tratamiento','otro')),
  uso             text CHECK (uso IN ('lejos','cerca','ambos')),
  nombre          text NOT NULL,
  armazon_propio  boolean DEFAULT false,
  articulo_id     bigint REFERENCES public.articulos(id),
  variante_id     bigint REFERENCES public.articulo_variantes(id),
  cantidad        numeric(10,3) NOT NULL DEFAULT 1,
  precio_unitario numeric(12,2) NOT NULL DEFAULT 0,
  descuento_pct   numeric(5,2)  DEFAULT 0,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  notas           text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE public.optica_orden_tareas (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id           bigint NOT NULL REFERENCES public.optica_ordenes(id) ON DELETE CASCADE,
  titulo             text   NOT NULL,
  descripcion        text,
  estado             text DEFAULT 'en_proceso'
                       CHECK (estado IN ('en_proceso','en_laboratorio','terminada')),
  fecha              date DEFAULT CURRENT_DATE,
  fecha_fin          date,
  usuario_id         uuid REFERENCES public.users(id),
  laboratorio_nombre text,
  laboratorio_tipo   text CHECK (laboratorio_tipo IN ('propio','externo')),
  created_by         uuid REFERENCES public.users(id),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
CREATE INDEX ON public.optica_orden_tareas (orden_id);

-- Nota: CHECK de metodo eliminado
CREATE TABLE public.optica_orden_pagos (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id       bigint NOT NULL REFERENCES public.optica_ordenes(id) ON DELETE CASCADE,
  caja_sesion_id bigint REFERENCES public.caja_sesiones(id),
  metodo         text   NOT NULL,
  monto          numeric(12,2) NOT NULL,
  concepto       text,
  referencia     text,
  fecha_pago     date DEFAULT CURRENT_DATE,
  usuario_id     uuid REFERENCES public.users(id),
  forma_pago_id  bigint REFERENCES public.formas_pago(id),
  cuotas         int,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX ON public.optica_orden_pagos (orden_id);


-- ============================================================
-- MÓDULO ÓPTICA — SERVICIOS / REPARACIONES
-- Migraciones: optica_servicios.sql, 20260609_servicio_tipos_estado,
--              20260609_vendedores (vendedor_id),
--              20260612_recargo (recargo_monto)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.optica_servicios (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero          text   UNIQUE NOT NULL,
  fecha           date DEFAULT CURRENT_DATE,
  fecha_prometida date,
  cliente_id      bigint REFERENCES public.clientes(id),
  costo_trabajo   numeric(12,2) DEFAULT 0,
  subtotal        numeric(12,2) DEFAULT 0,
  descuento_pct   numeric(5,2)  DEFAULT 0,
  descuento_monto numeric(12,2) DEFAULT 0,
  recargo_monto   numeric(10,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) DEFAULT 0,
  anticipo        numeric(12,2) DEFAULT 0,
  detalle         text,
  observaciones   text,
  estado          text NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','en_proceso','terminado','entregado','anulado')),
  vendedor_id     bigint REFERENCES public.vendedores(id),
  sucursal_id     bigint REFERENCES public.sucursales(id),
  created_by      uuid   NOT NULL REFERENCES public.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Migración: 20260609_servicio_tipos_estado (campo estado)
CREATE TABLE IF NOT EXISTS public.optica_servicio_tipos (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  servicio_id bigint NOT NULL REFERENCES public.optica_servicios(id) ON DELETE CASCADE,
  tipo        text   NOT NULL
                CHECK (tipo IN (
                  'garantia','soldadura','patillas','plaquetas','terminales',
                  'tanza','cristales','embutir_bisgra','pase_armazon',
                  'cambio_cristales_sol_neutros','otros'
                )),
  estado      text   NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','en_proceso','terminado')),
  detalle     text,
  precio      numeric(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.optica_servicio_tareas (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  servicio_id bigint NOT NULL REFERENCES public.optica_servicios(id) ON DELETE CASCADE,
  titulo      text   NOT NULL,
  descripcion text,
  estado      text   NOT NULL DEFAULT 'en_proceso'
                CHECK (estado IN ('en_proceso','terminada')),
  fecha       date,
  fecha_fin   date,
  usuario_id  uuid REFERENCES public.users(id),
  created_by  uuid REFERENCES public.users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Nota: CHECK de metodo eliminado
CREATE TABLE IF NOT EXISTS public.optica_servicio_pagos (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  servicio_id    bigint NOT NULL REFERENCES public.optica_servicios(id) ON DELETE CASCADE,
  caja_sesion_id bigint REFERENCES public.caja_sesiones(id),
  metodo         text   NOT NULL,
  monto          numeric(12,2) NOT NULL,
  concepto       text,
  referencia     text,
  fecha_pago     date DEFAULT CURRENT_DATE,
  usuario_id     uuid REFERENCES public.users(id),
  forma_pago_id  bigint REFERENCES public.formas_pago(id),
  cuotas         int,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_optica_servicios_sucursal ON public.optica_servicios (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_optica_servicios_cliente  ON public.optica_servicios (cliente_id);
CREATE INDEX IF NOT EXISTS idx_optica_servicios_estado   ON public.optica_servicios (estado);
CREATE INDEX IF NOT EXISTS idx_optica_servicio_tipos_sv  ON public.optica_servicio_tipos (servicio_id);
CREATE INDEX IF NOT EXISTS idx_optica_servicio_tareas_sv ON public.optica_servicio_tareas (servicio_id);
CREATE INDEX IF NOT EXISTS idx_optica_servicio_pagos_sv  ON public.optica_servicio_pagos (servicio_id);

ALTER TABLE public.optica_servicios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optica_servicio_tipos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optica_servicio_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optica_servicio_pagos  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_optica_servicios"
  ON public.optica_servicios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_optica_servicio_tipos"
  ON public.optica_servicio_tipos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_optica_servicio_tareas"
  ON public.optica_servicio_tareas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_optica_servicio_pagos"
  ON public.optica_servicio_pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ── FK diferidas de cobranzas ─────────────────────────────────
ALTER TABLE public.cobranzas
  ADD CONSTRAINT cobranzas_orden_id_fkey
    FOREIGN KEY (orden_id) REFERENCES public.ordenes_venta(id) ON DELETE SET NULL,
  ADD CONSTRAINT cobranzas_optica_orden_id_fkey
    FOREIGN KEY (optica_orden_id) REFERENCES public.optica_ordenes(id) ON DELETE SET NULL,
  ADD CONSTRAINT cobranzas_optica_servicio_id_fkey
    FOREIGN KEY (optica_servicio_id) REFERENCES public.optica_servicios(id) ON DELETE SET NULL;

CREATE INDEX idx_cobranzas_orden_id           ON public.cobranzas (orden_id);
CREATE INDEX idx_cobranzas_optica_orden_id    ON public.cobranzas (optica_orden_id);
CREATE INDEX idx_cobranzas_optica_servicio_id ON public.cobranzas (optica_servicio_id);


-- ============================================================
-- LOG DE ELIMINACIONES
-- Migración: 20260603_eliminaciones_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.eliminaciones_log (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo            text   NOT NULL
                    CHECK (tipo IN ('optica_ot','orden_venta','venta','remito')),
  referencia_id   bigint NOT NULL,
  numero          text,
  cliente_nombre  text,
  total           numeric(12,2),
  fecha_documento date,
  sucursal_id     bigint REFERENCES public.sucursales(id),
  estado_previo   text,
  usuario_id      uuid   NOT NULL REFERENCES auth.users(id),
  datos_extra     jsonb,
  eliminado_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX eliminaciones_log_tipo_idx
  ON public.eliminaciones_log (tipo, eliminado_at DESC);
CREATE INDEX eliminaciones_log_sucursal_idx
  ON public.eliminaciones_log (sucursal_id, eliminado_at DESC);
CREATE INDEX eliminaciones_log_usuario_idx
  ON public.eliminaciones_log (usuario_id, eliminado_at DESC);


-- ============================================================
-- PARÁMETROS DE SISTEMA
-- Migración: 20260612_parametros
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parametros (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave       text   NOT NULL UNIQUE,
  valor       text   NOT NULL,
  tipo        text   NOT NULL CHECK (tipo IN ('booleano','numero','lista_precio')),
  descripcion text,
  updated_at  timestamptz DEFAULT now()
);

INSERT INTO public.parametros (clave, valor, tipo, descripcion) VALUES
  ('controla_stock',         'false', 'booleano',    'Impide movimientos que dejen stock negativo'),
  ('maneja_variantes',       'false', 'booleano',    'Permite crear artículos con variantes (talle, color, etc.)'),
  ('cantidades_decimales',   'false', 'booleano',    'Permite ingresar cantidades con decimales en ventas, órdenes y remitos'),
  ('lista_precio_defecto_id','',      'lista_precio','Lista de precio seleccionada por defecto al abrir el POS')
ON CONFLICT (clave) DO NOTHING;

-- Actualizar lista_precio_defecto_id con la primera lista de venta activa
UPDATE public.parametros
SET valor = COALESCE(
  (SELECT id::text FROM public.listas_precio WHERE categoria = 'venta' AND activo = true ORDER BY id LIMIT 1),
  ''
)
WHERE clave = 'lista_precio_defecto_id' AND valor = '';


-- ============================================================
-- FUNCIONES
-- ============================================================

-- Búsqueda de artículos: exacto en codigo/barras → parcial en codigo/nombre
-- Migración: 20260610_buscar_articulos_fix_numeric
CREATE OR REPLACE FUNCTION public.buscar_articulos(p_query text, p_limit int DEFAULT 20)
RETURNS TABLE (
  id            bigint,
  codigo        text,
  nombre        text,
  tipo_articulo text,
  precio_venta  numeric,
  stock_actual  numeric,
  imagen_url    text
) LANGUAGE sql STABLE AS $$
  SELECT a.id, a.codigo, a.nombre, a.tipo_articulo, a.precio_venta, a.stock_actual, a.imagen_url
  FROM public.articulos a
  WHERE a.activo = true
    AND (
      a.codigo           ILIKE p_query
      OR a.codigo_barras ILIKE p_query
      OR (
        NOT EXISTS (
          SELECT 1 FROM public.articulos a2
          WHERE a2.activo = true
            AND (a2.codigo ILIKE p_query OR a2.codigo_barras ILIKE p_query)
        )
        AND (
          a.codigo  ILIKE '%' || p_query || '%'
          OR a.nombre ILIKE '%' || p_query || '%'
        )
      )
    )
  ORDER BY
    CASE
      WHEN a.codigo        ILIKE p_query               THEN 0
      WHEN a.codigo_barras ILIKE p_query               THEN 1
      WHEN a.codigo        ILIKE '%' || p_query || '%' THEN 2
      ELSE 3
    END,
    a.nombre
  LIMIT p_limit;
$$;

-- Saldo de cliente en cuenta corriente (positivo = debe)
CREATE OR REPLACE FUNCTION public.saldo_cliente(p_cliente_id bigint)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    SUM(CASE WHEN tipo = 'CARGO' THEN monto ELSE -monto END),
    0
  )
  FROM public.cobranzas
  WHERE cliente_id = p_cliente_id;
$$;

-- Monto esperado en caja al cierre
-- FIX 20260712: eliminar doble conteo — venta_pagos EFECTIVO ya se registra en caja_movimientos
CREATE OR REPLACE FUNCTION public.caja_monto_esperado(p_sesion_id bigint)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT
    cs.monto_apertura
    + COALESCE((
        SELECT SUM(monto)
        FROM public.caja_movimientos
        WHERE sesion_id = p_sesion_id AND tipo = 'ingreso'
      ), 0)
    - COALESCE((
        SELECT SUM(monto)
        FROM public.caja_movimientos
        WHERE sesion_id = p_sesion_id AND tipo = 'egreso'
      ), 0)
  FROM public.caja_sesiones cs
  WHERE cs.id = p_sesion_id;
$$;

-- RPC: venta_pagos + cobranzas CARGO (con formas_pago y recargo)
-- Migración: 20260610_rpc_pagos_atomicos → 20260611_rpc_formas_pago
CREATE OR REPLACE FUNCTION public.registrar_pagos_venta(
  p_venta_id    int,
  p_cliente_id  int,
  p_fecha       date,
  p_numero      text,
  p_sucursal_id int,
  p_usuario_id  uuid,
  p_pagos       jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_pago     jsonb;
  v_cc_monto numeric := 0;
BEGIN
  FOR v_pago IN SELECT * FROM jsonb_array_elements(p_pagos) LOOP
    INSERT INTO public.venta_pagos
      (venta_id, metodo, monto, referencia, nota_credito_id, forma_pago_id, cuotas, fecha_pago)
    VALUES (
      p_venta_id,
      v_pago->>'metodo',
      (v_pago->>'monto')::numeric,
      NULLIF(v_pago->>'referencia', ''),
      (v_pago->>'nota_credito_id')::int,
      (v_pago->>'forma_pago_id')::bigint,
      (v_pago->>'cuotas')::int,
      COALESCE((v_pago->>'fecha_pago')::date, p_fecha)
    );
    IF v_pago->>'metodo' = 'CUENTA_CORRIENTE' THEN
      v_cc_monto := v_cc_monto + (v_pago->>'monto')::numeric;
    END IF;
  END LOOP;

  IF v_cc_monto > 0 AND p_cliente_id IS NOT NULL THEN
    INSERT INTO public.cobranzas
      (cliente_id, venta_id, tipo, monto, fecha, descripcion, sucursal_id, usuario_id)
    VALUES
      (p_cliente_id, p_venta_id, 'CARGO', v_cc_monto, p_fecha, 'Venta ' || p_numero, p_sucursal_id, p_usuario_id);
  END IF;
END;
$$;

-- RPC: pago de OT óptica + CC + recargo (v3)
-- Migración: 20260612_rpc_recargo
CREATE OR REPLACE FUNCTION public.registrar_pago_optica_orden(
  p_orden_id       int,
  p_caja_sesion_id int,
  p_metodo         text,
  p_monto          numeric,
  p_concepto       text,
  p_referencia     text,
  p_fecha_pago     date,
  p_usuario_id     uuid,
  p_cliente_id     int,
  p_sucursal_id    int,
  p_numero         text,
  p_forma_pago_id  bigint  DEFAULT NULL,
  p_cuotas         int     DEFAULT NULL,
  p_recargo_monto  numeric DEFAULT 0
) RETURNS json LANGUAGE plpgsql AS $$
DECLARE
  v_id   int;
  v_pago json;
BEGIN
  INSERT INTO public.optica_orden_pagos
    (orden_id, caja_sesion_id, metodo, monto, concepto, referencia, fecha_pago, usuario_id, forma_pago_id, cuotas)
  VALUES
    (p_orden_id, p_caja_sesion_id, p_metodo, p_monto, p_concepto,
     NULLIF(p_referencia,''), p_fecha_pago, p_usuario_id, p_forma_pago_id, p_cuotas)
  RETURNING id INTO v_id;

  SELECT row_to_json(t) INTO v_pago FROM public.optica_orden_pagos t WHERE id = v_id;

  IF p_metodo = 'CUENTA_CORRIENTE' AND p_cliente_id IS NOT NULL THEN
    INSERT INTO public.cobranzas
      (cliente_id, tipo, monto, fecha, descripcion, sucursal_id, optica_orden_id, usuario_id)
    VALUES
      (p_cliente_id, 'CARGO', p_monto, p_fecha_pago, 'OT ' || p_numero, p_sucursal_id, p_orden_id, p_usuario_id);
  END IF;

  IF p_recargo_monto IS DISTINCT FROM 0 AND p_recargo_monto IS NOT NULL THEN
    UPDATE public.optica_ordenes
    SET recargo_monto = p_recargo_monto,
        total         = total - recargo_monto + p_recargo_monto
    WHERE id = p_orden_id;
  END IF;

  RETURN v_pago;
END;
$$;

-- RPC: pago de servicio óptica + CC + recargo (v3)
-- Migración: 20260612_rpc_recargo
CREATE OR REPLACE FUNCTION public.registrar_pago_optica_servicio(
  p_servicio_id    int,
  p_caja_sesion_id int,
  p_metodo         text,
  p_monto          numeric,
  p_concepto       text,
  p_referencia     text,
  p_fecha_pago     date,
  p_usuario_id     uuid,
  p_cliente_id     int,
  p_sucursal_id    int,
  p_numero         text,
  p_forma_pago_id  bigint  DEFAULT NULL,
  p_cuotas         int     DEFAULT NULL,
  p_recargo_monto  numeric DEFAULT 0
) RETURNS json LANGUAGE plpgsql AS $$
DECLARE
  v_id   int;
  v_pago json;
BEGIN
  INSERT INTO public.optica_servicio_pagos
    (servicio_id, caja_sesion_id, metodo, monto, concepto, referencia, fecha_pago, usuario_id, forma_pago_id, cuotas)
  VALUES
    (p_servicio_id, p_caja_sesion_id, p_metodo, p_monto, p_concepto,
     NULLIF(p_referencia,''), p_fecha_pago, p_usuario_id, p_forma_pago_id, p_cuotas)
  RETURNING id INTO v_id;

  SELECT row_to_json(t) INTO v_pago FROM public.optica_servicio_pagos t WHERE id = v_id;

  IF p_metodo = 'CUENTA_CORRIENTE' AND p_cliente_id IS NOT NULL THEN
    INSERT INTO public.cobranzas
      (cliente_id, tipo, monto, fecha, descripcion, sucursal_id, optica_servicio_id, usuario_id)
    VALUES
      (p_cliente_id, 'CARGO', p_monto, p_fecha_pago, 'SV ' || p_numero, p_sucursal_id, p_servicio_id, p_usuario_id);
  END IF;

  IF p_recargo_monto IS DISTINCT FROM 0 AND p_recargo_monto IS NOT NULL THEN
    UPDATE public.optica_servicios
    SET recargo_monto = p_recargo_monto,
        total         = total - recargo_monto + p_recargo_monto
    WHERE id = p_servicio_id;
  END IF;

  RETURN v_pago;
END;
$$;
