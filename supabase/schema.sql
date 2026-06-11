-- ============================================================
-- MGA Pto. Venta — Schema completo
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Extensión para búsqueda fuzzy
create extension if not exists pg_trgm;

-- ============================================================
-- ROLES
-- ============================================================
create table public.roles (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  description text,
  is_default  boolean default false,
  created_at  timestamptz default now()
);
create unique index roles_is_default_true on public.roles (is_default) where is_default = true;

insert into public.roles (name, description, is_default) values
  ('Administrador', 'Acceso total al sistema', false),
  ('Supervisor',    'Reportes y gestión de stock', false),
  ('Vendedor',      'Punto de venta', true);

-- ============================================================
-- USUARIOS
-- ============================================================
create table public.users (
  id         uuid references auth.users(id) on delete cascade primary key,
  email      text not null,
  name       text,
  role_id    bigint not null references public.roles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.users enable row level security;

create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_service_role_all" on public.users
  for all using (auth.role() = 'service_role');

-- ============================================================
-- PERMISOS POR ROL
-- ============================================================
create table public.role_permissions (
  id         bigint generated always as identity primary key,
  role_id    bigint  not null references public.roles(id) on delete cascade,
  operation  text    not null,
  allowed    boolean not null default false,
  unique(role_id, operation)
);

-- Administrador: acceso total
insert into public.role_permissions (role_id, operation, allowed)
select 1, op, true
from unnest(array[
  'ventas.pos.cobrar',
  'ventas.historial.ver','ventas.historial.anular',
  'ventas.ordenes.ver','ventas.ordenes.crear','ventas.ordenes.editar','ventas.ordenes.confirmar','ventas.ordenes.anular',
  'ventas.clientes.ver','ventas.clientes.crear','ventas.clientes.editar','ventas.clientes.desactivar',
  'ventas.notas-credito.ver','ventas.notas-credito.crear','ventas.notas-credito.anular',
  'inventario.articulos.ver','inventario.articulos.crear','inventario.articulos.editar','inventario.articulos.desactivar',
  'inventario.remitos.ver','inventario.remitos.crear','inventario.remitos.confirmar','inventario.remitos.anular',
  'inventario.ajustes.ver','inventario.ajustes.aplicar',
  'inventario.proveedores.ver','inventario.proveedores.crear','inventario.proveedores.editar','inventario.proveedores.desactivar',
  'consultas.stock.ver','consultas.seguimiento.ver','consultas.precios_costo.ver',
  'listados.cobranzas.ver','listados.ventas_articulos.ver','listados.precios.ver',
  'caja.caja.ver','caja.caja.abrir','caja.caja.cerrar','caja.caja.movimiento',
  'caja.cobranzas.ver',
  'optica.ordenes.ver','optica.ordenes.crear','optica.ordenes.editar','optica.ordenes.cambiar-estado','optica.ordenes.pagar',
  'optica.medicos.ver','optica.medicos.crear','optica.medicos.editar','optica.medicos.eliminar',
  'altas.marcas.ver','altas.marcas.crear','altas.marcas.editar','altas.marcas.eliminar',
  'altas.categorias.ver','altas.categorias.crear','altas.categorias.editar','altas.categorias.eliminar',
  'altas.subcategorias.ver','altas.subcategorias.crear','altas.subcategorias.editar','altas.subcategorias.eliminar',
  'altas.atributos.ver','altas.atributos.crear','altas.atributos.editar','altas.atributos.eliminar',
  'admin.usuarios.ver','admin.usuarios.crear','admin.usuarios.editar',
  'admin.roles.ver','admin.roles.crear','admin.roles.editar','admin.roles.eliminar',
  'admin.permisos.ver','admin.permisos.editar',
  'admin.sucursales.ver','admin.sucursales.crear','admin.sucursales.editar','admin.sucursales.eliminar',
  'admin.listas_precio.ver','admin.listas_precio.crear','admin.listas_precio.editar','admin.listas_precio.eliminar'
]) as op;

-- Supervisor
insert into public.role_permissions (role_id, operation, allowed) values
  (2,'ventas.pos.cobrar',true),(2,'ventas.historial.ver',true),(2,'ventas.historial.anular',true),
  (2,'ventas.ordenes.ver',true),(2,'ventas.ordenes.crear',true),(2,'ventas.ordenes.editar',true),(2,'ventas.ordenes.confirmar',true),(2,'ventas.ordenes.anular',true),
  (2,'ventas.clientes.ver',true),(2,'ventas.clientes.crear',true),(2,'ventas.clientes.editar',true),(2,'ventas.clientes.desactivar',false),
  (2,'ventas.notas-credito.ver',true),(2,'ventas.notas-credito.crear',true),(2,'ventas.notas-credito.anular',false),
  (2,'inventario.articulos.ver',true),(2,'inventario.articulos.crear',false),(2,'inventario.articulos.editar',false),(2,'inventario.articulos.desactivar',false),
  (2,'inventario.remitos.ver',true),(2,'inventario.remitos.crear',true),(2,'inventario.remitos.confirmar',true),(2,'inventario.remitos.anular',false),
  (2,'inventario.ajustes.ver',true),(2,'inventario.ajustes.aplicar',true),
  (2,'inventario.proveedores.ver',true),(2,'inventario.proveedores.crear',false),(2,'inventario.proveedores.editar',false),(2,'inventario.proveedores.desactivar',false),
  (2,'consultas.stock.ver',true),(2,'consultas.seguimiento.ver',true),(2,'consultas.precios_costo.ver',true),
  (2,'listados.cobranzas.ver',true),(2,'listados.ventas_articulos.ver',true),(2,'listados.precios.ver',true),
  (2,'caja.caja.ver',true),(2,'caja.caja.abrir',true),(2,'caja.caja.cerrar',true),(2,'caja.caja.movimiento',true),
  (2,'caja.cobranzas.ver',true),
  (2,'optica.ordenes.ver',true),(2,'optica.ordenes.crear',true),(2,'optica.ordenes.editar',true),(2,'optica.ordenes.cambiar-estado',true),(2,'optica.ordenes.pagar',true),
  (2,'optica.medicos.ver',true),(2,'optica.medicos.crear',false),(2,'optica.medicos.editar',false),(2,'optica.medicos.eliminar',false),
  (2,'altas.marcas.ver',true),(2,'altas.marcas.crear',false),(2,'altas.marcas.editar',false),(2,'altas.marcas.eliminar',false),
  (2,'altas.categorias.ver',true),(2,'altas.categorias.crear',false),(2,'altas.categorias.editar',false),(2,'altas.categorias.eliminar',false),
  (2,'altas.subcategorias.ver',true),(2,'altas.subcategorias.crear',false),(2,'altas.subcategorias.editar',false),(2,'altas.subcategorias.eliminar',false),
  (2,'altas.atributos.ver',true),(2,'altas.atributos.crear',false),(2,'altas.atributos.editar',false),(2,'altas.atributos.eliminar',false),
  (2,'admin.usuarios.ver',false),(2,'admin.usuarios.crear',false),(2,'admin.usuarios.editar',false),
  (2,'admin.roles.ver',false),(2,'admin.roles.crear',false),(2,'admin.roles.editar',false),(2,'admin.roles.eliminar',false),
  (2,'admin.permisos.ver',false),(2,'admin.permisos.editar',false),
  (2,'admin.sucursales.ver',false),(2,'admin.sucursales.crear',false),(2,'admin.sucursales.editar',false),(2,'admin.sucursales.eliminar',false),
  (2,'admin.listas_precio.ver',false),(2,'admin.listas_precio.crear',false),(2,'admin.listas_precio.editar',false),(2,'admin.listas_precio.eliminar',false);

-- Vendedor
insert into public.role_permissions (role_id, operation, allowed) values
  (3,'ventas.pos.cobrar',true),(3,'ventas.historial.ver',true),(3,'ventas.historial.anular',false),
  (3,'ventas.ordenes.ver',true),(3,'ventas.ordenes.crear',true),(3,'ventas.ordenes.editar',false),(3,'ventas.ordenes.confirmar',false),(3,'ventas.ordenes.anular',false),
  (3,'ventas.clientes.ver',true),(3,'ventas.clientes.crear',true),(3,'ventas.clientes.editar',false),(3,'ventas.clientes.desactivar',false),
  (3,'ventas.notas-credito.ver',false),(3,'ventas.notas-credito.crear',false),(3,'ventas.notas-credito.anular',false),
  (3,'inventario.articulos.ver',true),(3,'inventario.articulos.crear',false),(3,'inventario.articulos.editar',false),(3,'inventario.articulos.desactivar',false),
  (3,'inventario.remitos.ver',false),(3,'inventario.remitos.crear',false),(3,'inventario.remitos.confirmar',false),(3,'inventario.remitos.anular',false),
  (3,'inventario.ajustes.ver',false),(3,'inventario.ajustes.aplicar',false),
  (3,'inventario.proveedores.ver',false),(3,'inventario.proveedores.crear',false),(3,'inventario.proveedores.editar',false),(3,'inventario.proveedores.desactivar',false),
  (3,'consultas.stock.ver',true),(3,'consultas.seguimiento.ver',false),(3,'consultas.precios_costo.ver',false),
  (3,'listados.cobranzas.ver',false),(3,'listados.ventas_articulos.ver',false),(3,'listados.precios.ver',false),
  (3,'caja.caja.ver',true),(3,'caja.caja.abrir',true),(3,'caja.caja.cerrar',false),(3,'caja.caja.movimiento',false),
  (3,'caja.cobranzas.ver',false),
  (3,'optica.ordenes.ver',true),(3,'optica.ordenes.crear',true),(3,'optica.ordenes.editar',false),(3,'optica.ordenes.cambiar-estado',false),(3,'optica.ordenes.pagar',true),
  (3,'optica.medicos.ver',true),(3,'optica.medicos.crear',false),(3,'optica.medicos.editar',false),(3,'optica.medicos.eliminar',false),
  (3,'altas.marcas.ver',false),(3,'altas.marcas.crear',false),(3,'altas.marcas.editar',false),(3,'altas.marcas.eliminar',false),
  (3,'altas.categorias.ver',false),(3,'altas.categorias.crear',false),(3,'altas.categorias.editar',false),(3,'altas.categorias.eliminar',false),
  (3,'altas.subcategorias.ver',false),(3,'altas.subcategorias.crear',false),(3,'altas.subcategorias.editar',false),(3,'altas.subcategorias.eliminar',false),
  (3,'altas.atributos.ver',false),(3,'altas.atributos.crear',false),(3,'altas.atributos.editar',false),(3,'altas.atributos.eliminar',false),
  (3,'admin.usuarios.ver',false),(3,'admin.usuarios.crear',false),(3,'admin.usuarios.editar',false),
  (3,'admin.roles.ver',false),(3,'admin.roles.crear',false),(3,'admin.roles.editar',false),(3,'admin.roles.eliminar',false),
  (3,'admin.permisos.ver',false),(3,'admin.permisos.editar',false),
  (3,'admin.sucursales.ver',false),(3,'admin.sucursales.crear',false),(3,'admin.sucursales.editar',false),(3,'admin.sucursales.eliminar',false),
  (3,'admin.listas_precio.ver',false),(3,'admin.listas_precio.crear',false),(3,'admin.listas_precio.editar',false),(3,'admin.listas_precio.eliminar',false);

-- ============================================================
-- CLIENTES
-- ============================================================
create table public.clientes (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  tipo       text not null default 'PARTICULAR' check (tipo in ('PARTICULAR','EMPRESA','COMERCIO')),
  email      text,
  telefono   text,
  direccion  text,
  localidad  text,
  cuit       text,
  notas      text,
  activo     boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index clientes_nombre_idx on public.clientes using gin (nombre gin_trgm_ops);

-- ============================================================
-- PROVEEDORES
-- ============================================================
create table public.proveedores (
  id         bigint generated by default as identity primary key,
  nombre     text not null,
  cuit       text,
  telefono   text,
  email      text,
  direccion  text,
  localidad  text,
  provincia  text,
  cod_postal text,
  contacto   text,
  pais       text not null default 'ARGENTINA',
  tipo_iva   text,
  notas      text,
  activo     boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CATÁLOGOS
-- ============================================================
create table public.categorias (
  id         bigint generated always as identity primary key,
  nombre     text not null unique,
  activo     boolean default true,
  created_at timestamptz default now()
);

create table public.marcas (
  id         bigint generated always as identity primary key,
  nombre     text not null unique,
  activo     boolean default true,
  created_at timestamptz default now()
);

create table public.atributo_tipos (
  id         bigint generated always as identity primary key,
  nombre     text not null unique,
  activo     boolean default true,
  created_at timestamptz default now()
);

insert into public.atributo_tipos (nombre) values
  ('Talle'), ('Color'), ('Tamaño'), ('Material');

create table public.unidades_medida (
  id         bigint generated always as identity primary key,
  nombre     text not null unique,
  activo     boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.unidades_medida (nombre) values
  ('Unidad'), ('Kg'), ('Gr'), ('Lt'), ('Ml'),
  ('Caja'), ('Bolsa'), ('Metro'), ('Par');

-- ============================================================
-- ARTÍCULOS
-- ============================================================
create table public.articulos (
  id            bigint generated always as identity primary key,
  codigo        text unique,
  nombre        text not null,
  descripcion   text,
  tipo_articulo text not null default 'simple' check (tipo_articulo in ('simple','con_variantes')),
  categoria_id  bigint references public.categorias(id),
  marca_id      bigint references public.marcas(id),
  proveedor_id  bigint references public.proveedores(id),
  precio_venta  numeric(12,2),
  precio_compra numeric(12,2),
  stock_actual  numeric(10,3) not null default 0,
  stock_minimo  numeric(10,3) not null default 0,
  unidad_id     bigint references public.unidades_medida(id),
  codigo_barras text unique,
  activo        boolean not null default true,
  imagen_url    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index articulos_nombre_trgm_idx on public.articulos using gin (nombre gin_trgm_ops);
create index articulos_codigo_idx on public.articulos (codigo) where codigo is not null;

-- ============================================================
-- VARIANTES
-- ============================================================
create table public.articulo_variantes (
  id            bigint generated always as identity primary key,
  articulo_id   bigint not null references public.articulos(id) on delete cascade,
  sku           text unique,
  codigo_barras text unique,
  precio_venta  numeric(12,2),
  precio_compra numeric(12,2),
  stock_actual  numeric(10,3) not null default 0,
  stock_minimo  numeric(10,3) not null default 0,
  activo        boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index variantes_articulo_idx on public.articulo_variantes (articulo_id);

create table public.variante_atributos (
  id               bigint generated always as identity primary key,
  variante_id      bigint not null references public.articulo_variantes(id) on delete cascade,
  atributo_tipo_id bigint not null references public.atributo_tipos(id),
  valor            text not null,
  unique(variante_id, atributo_tipo_id)
);
create index variante_atributos_variante_idx on public.variante_atributos (variante_id);

-- ============================================================
-- CAJA
-- ============================================================
create table public.caja_sesiones (
  id             bigint generated always as identity primary key,
  usuario_id     uuid not null references public.users(id),
  fecha_apertura timestamptz not null default now(),
  monto_apertura numeric(12,2) not null default 0,
  fecha_cierre   timestamptz,
  monto_cierre   numeric(12,2),
  monto_esperado numeric(12,2),
  diferencia     numeric(12,2),
  observaciones  text,
  estado         text not null default 'abierta' check (estado in ('abierta','cerrada')),
  vendedor_id    bigint references public.vendedores(id),
  created_at     timestamptz default now()
);
create unique index caja_un_abierta on public.caja_sesiones (estado) where estado = 'abierta';

create table public.caja_movimientos (
  id         bigint generated always as identity primary key,
  sesion_id  bigint not null references public.caja_sesiones(id),
  tipo       text not null check (tipo in ('ingreso','egreso')),
  concepto   text not null,
  monto      numeric(12,2) not null,
  usuario_id uuid not null references public.users(id),
  vendedor_id bigint references public.vendedores(id),
  created_at timestamptz default now()
);

-- ============================================================
-- VENTAS / POS
-- ============================================================
create table public.ventas (
  id              bigint generated always as identity primary key,
  numero          text not null unique,
  fecha           date not null default current_date,
  cliente_id      bigint references public.clientes(id),
  vendedor_id     bigint references public.vendedores(id),
  caja_sesion_id  bigint not null references public.caja_sesiones(id),
  subtotal        numeric(12,2) not null default 0,
  descuento_pct   numeric(5,2)  not null default 0,
  descuento_monto numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  sucursal_id     bigint references public.sucursales(id),
  estado          text not null default 'completada' check (estado in ('completada','anulada')),
  observaciones   text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index ventas_fecha_idx       on public.ventas (fecha desc);
create index ventas_caja_sesion_idx on public.ventas (caja_sesion_id);

create table public.venta_items (
  id                   bigint generated always as identity primary key,
  venta_id             bigint not null references public.ventas(id) on delete cascade,
  articulo_id          bigint not null references public.articulos(id),
  variante_id          bigint references public.articulo_variantes(id),
  nombre_articulo      text not null,
  descripcion_variante text,
  cantidad             numeric(10,3) not null,
  precio_unitario      numeric(12,2) not null,
  descuento_pct        numeric(5,2)  not null default 0,
  subtotal             numeric(12,2) not null,
  created_at           timestamptz default now()
);

-- ============================================================
-- NOTAS DE CRÉDITO
-- ============================================================
create table if not exists public.notas_credito (
  id               bigint generated always as identity primary key,
  numero           text not null unique,
  cliente_id       bigint not null references public.clientes(id),
  fecha            date not null default current_date,
  monto            numeric(12,2) not null check (monto > 0),
  monto_disponible numeric(12,2) not null check (monto_disponible >= 0),
  estado           text not null default 'pendiente' check (estado in ('pendiente','utilizada','anulada')),
  observaciones    text,
  vendedor_id      bigint references public.vendedores(id),
  created_by       uuid not null references public.users(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists notas_credito_cliente_idx on public.notas_credito (cliente_id, created_at desc);

create table public.venta_pagos (
  id              bigint generated always as identity primary key,
  venta_id        bigint not null references public.ventas(id) on delete cascade,
  metodo          text not null check (metodo in ('EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO','TARJETA_CREDITO','CUENTA_CORRIENTE','NOTA_CREDITO','OTRO')),
  monto           numeric(12,2) not null,
  referencia      text,
  nota_credito_id bigint references public.notas_credito(id),
  created_at      timestamptz default now()
);

-- ============================================================
-- MOVIMIENTOS DE STOCK
-- ============================================================
create table public.movimientos_stock (
  id             bigint generated always as identity primary key,
  articulo_id    bigint not null references public.articulos(id),
  variante_id    bigint references public.articulo_variantes(id),
  tipo           text not null check (tipo in ('entrada','salida','ajuste','venta','devolucion')),
  cantidad       numeric(10,3) not null,
  costo_unitario numeric(12,2),
  stock_antes    numeric(10,3) not null,
  stock_despues  numeric(10,3) not null,
  venta_id       bigint references public.ventas(id),
  venta_item_id  bigint references public.venta_items(id),
  proveedor_id   bigint references public.proveedores(id),
  sucursal_id    bigint references public.sucursales(id),
  usuario_id     uuid not null references public.users(id),
  referencia     text,
  observaciones  text,
  created_at     timestamptz default now()
);
create index movimientos_stock_articulo_idx on public.movimientos_stock (articulo_id, created_at desc);

-- ============================================================
-- COBRANZAS
-- ============================================================
create table public.cobranzas (
  id                  bigint generated always as identity primary key,
  cliente_id          bigint not null references public.clientes(id),
  venta_id            bigint references public.ventas(id),
  orden_id            bigint references public.ordenes_venta(id),          -- OV que originó el CARGO
  optica_orden_id     bigint references public.optica_ordenes(id),         -- OT que originó el CARGO
  optica_servicio_id  bigint references public.optica_servicios(id),       -- SV que originó el CARGO
  tipo                text not null check (tipo in ('CARGO','PAGO')),
  monto               numeric(12,2) not null,
  fecha               date not null default current_date,
  metodo              text check (metodo in ('EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO','TARJETA_CREDITO','CHEQUE','OTRO')),
  descripcion         text,
  notas               text,
  usuario_id          uuid not null references public.users(id),
  created_at          timestamptz default now()
);
create index cobranzas_cliente_idx           on public.cobranzas (cliente_id, fecha desc);
create index cobranzas_venta_idx             on public.cobranzas (venta_id) where venta_id is not null;
create index cobranzas_orden_idx             on public.cobranzas (orden_id) where orden_id is not null;
create index cobranzas_optica_orden_idx      on public.cobranzas (optica_orden_id) where optica_orden_id is not null;
create index cobranzas_optica_servicio_idx   on public.cobranzas (optica_servicio_id) where optica_servicio_id is not null;

-- ============================================================
-- SUCURSALES
-- ============================================================
create table if not exists public.sucursales (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  direccion  text,
  telefono   text,
  activo     boolean not null default true,
  logo_url        text,                        -- URL pública en Supabase Storage (bucket 'sucursales')
  color           text,                        -- Color de marca en hex (#RRGGBB), usado en sidebar y UI
  controla_stock  boolean not null default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists public.user_sucursales (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  sucursal_id bigint not null references public.sucursales(id) on delete cascade,
  unique(user_id, sucursal_id)
);

-- ============================================================
-- VENDEDORES
-- ============================================================
create table if not exists public.vendedores (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  sucursal_id bigint not null references public.sucursales(id),
  activo      boolean not null default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- STOCK POR SUCURSAL
-- ============================================================
create table if not exists public.articulo_stock (
  id           bigint generated always as identity primary key,
  articulo_id  bigint not null references public.articulos(id) on delete cascade,
  variante_id  bigint references public.articulo_variantes(id) on delete cascade,
  sucursal_id  bigint not null references public.sucursales(id),
  stock_actual numeric(10,3) not null default 0,
  stock_minimo numeric(10,3) not null default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create unique index if not exists articulo_stock_simple_idx
  on public.articulo_stock (articulo_id, sucursal_id)
  where variante_id is null;
create unique index if not exists articulo_stock_variante_idx
  on public.articulo_stock (articulo_id, variante_id, sucursal_id)
  where variante_id is not null;
create index if not exists articulo_stock_sucursal_idx on public.articulo_stock (sucursal_id);

-- ============================================================
-- ÓRDENES DE VENTA
-- ============================================================
create table if not exists public.ordenes_venta (
  id              bigint generated always as identity primary key,
  numero          text not null unique,
  fecha           date not null default current_date,
  vencimiento     date,
  cliente_id      bigint references public.clientes(id),
  vendedor_id     bigint references public.vendedores(id),
  condicion_pago  text not null default 'contado' check (condicion_pago in ('contado','cuenta_corriente','otro')),
  subtotal        numeric(12,2) not null default 0,
  descuento_pct   numeric(5,2)  not null default 0,
  descuento_monto numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  estado          text not null default 'borrador' check (estado in ('borrador','confirmada','anulada')),
  sucursal_id     bigint references public.sucursales(id),
  observaciones   text,
  created_by      uuid not null references public.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists ordenes_fecha_idx on public.ordenes_venta (fecha desc);

create table if not exists public.orden_venta_items (
  id                   bigint generated always as identity primary key,
  orden_id             bigint not null references public.ordenes_venta(id) on delete cascade,
  articulo_id          bigint not null references public.articulos(id),
  variante_id          bigint references public.articulo_variantes(id),
  nombre_articulo      text not null,
  descripcion_variante text,
  cantidad             numeric(10,3) not null,
  precio_unitario      numeric(12,2) not null,
  descuento_pct        numeric(5,2)  not null default 0,
  subtotal             numeric(12,2) not null,
  created_at           timestamptz default now()
);
create index if not exists orden_items_orden_idx on public.orden_venta_items (orden_id);

create table if not exists public.orden_venta_pagos (
  id              bigint generated always as identity primary key,
  orden_id        bigint not null references public.ordenes_venta(id) on delete cascade,
  metodo          text not null check (metodo in ('EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO','TARJETA_CREDITO','CUENTA_CORRIENTE','NOTA_CREDITO','CHEQUE','OTRO')),
  monto           numeric(12,2) not null,
  referencia      text,
  nota_credito_id bigint references public.notas_credito(id),
  fecha_pago      date,
  created_at      timestamptz default now()
);

-- ============================================================
-- REMITOS
-- ============================================================
create table if not exists public.remitos (
  id                       bigint generated always as identity primary key,
  numero                   text not null unique,
  tipo                     text not null check (tipo in ('entrada','salida')),
  sucursal_id              bigint not null references public.sucursales(id),
  contraparte_tipo         text not null check (contraparte_tipo in ('persona','proveedor','sucursal')),
  contraparte_nombre       text,
  contraparte_sucursal_id  bigint references public.sucursales(id),
  contraparte_proveedor_id bigint references public.proveedores(id),
  fecha                    timestamptz not null default now(),
  estado                   text not null default 'borrador' check (estado in ('borrador','confirmado','anulado')),
  observaciones            text,
  nro_externo              text,
  vendedor_id              bigint references public.vendedores(id),
  created_by               uuid not null references public.users(id),
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);
create index if not exists remitos_sucursal_idx on public.remitos (sucursal_id, created_at desc);

create table if not exists public.remito_items (
  id             bigint generated always as identity primary key,
  remito_id      bigint not null references public.remitos(id) on delete cascade,
  articulo_id    bigint not null references public.articulos(id),
  variante_id    bigint references public.articulo_variantes(id),
  cantidad       numeric(10,3) not null,
  costo_unitario numeric(12,2),
  created_at     timestamptz default now()
);
create index if not exists remito_items_remito_idx on public.remito_items (remito_id);

-- ============================================================
-- LISTAS DE PRECIO
-- ============================================================
create table if not exists public.listas_precio (
  id              bigint generated always as identity primary key,
  nombre          text not null unique,
  tipo            text not null default 'manual'
                    check (tipo in ('manual', 'calculada')),
  categoria       text not null default 'venta'
                    check (categoria in ('costo', 'venta')),
  lista_base_id   bigint references public.listas_precio(id) on delete set null,
  porcentaje      numeric(8,4),
  activo          boolean not null default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Historial de precios por artículo / variante / lista
create table if not exists public.precios (
  id                  bigint generated always as identity primary key,
  articulo_id         bigint not null references public.articulos(id) on delete cascade,
  variante_id         bigint references public.articulo_variantes(id) on delete cascade,
  lista_precio_id     bigint not null references public.listas_precio(id) on delete cascade,
  precio              numeric(12,2) not null,
  vigente_desde       timestamptz not null default now(),
  origen_tipo         text check (origen_tipo in ('manual', 'proveedor', 'sucursal', 'remito')),
  origen_proveedor_id bigint references public.proveedores(id) on delete set null,
  origen_sucursal_id  bigint references public.sucursales(id) on delete set null,
  remito_id           bigint references public.remitos(id) on delete set null,
  created_by          uuid references auth.users(id),
  created_at          timestamptz default now()
);
create index if not exists precios_articulo_lista_idx
  on public.precios (articulo_id, lista_precio_id, vigente_desde desc);
create index if not exists precios_variante_lista_idx
  on public.precios (variante_id, lista_precio_id, vigente_desde desc)
  where variante_id is not null;

-- ============================================================
-- FUNCIONES
-- ============================================================

-- Búsqueda fuzzy de artículos para POS y ajuste de stock
create or replace function buscar_articulos(p_query text, p_limit int default 20)
returns table (
  id            bigint,
  codigo        text,
  nombre        text,
  tipo_articulo text,
  precio_venta  numeric,
  stock_actual  numeric,
  imagen_url    text
)
language sql stable as $$
  select a.id, a.codigo, a.nombre, a.tipo_articulo, a.precio_venta, a.stock_actual, a.imagen_url
  from public.articulos a
  where a.activo = true
    and (
      a.codigo           ilike p_query
      or a.codigo_barras ilike p_query
      or (
        not exists (
          select 1 from public.articulos a2
          where a2.activo = true
            and (a2.codigo ilike p_query or a2.codigo_barras ilike p_query)
        )
        and (
          a.codigo  ilike '%' || p_query || '%'
          or a.nombre ilike '%' || p_query || '%'
        )
      )
    )
  order by
    case
      when a.codigo        ilike p_query               then 0
      when a.codigo_barras ilike p_query               then 1
      when a.codigo        ilike '%' || p_query || '%' then 2
      else 3
    end,
    a.nombre
  limit p_limit;
$$;

-- Saldo de cliente (positivo = debe)
create or replace function saldo_cliente(p_cliente_id bigint)
returns numeric language sql stable as $$
  select coalesce(
    sum(case when tipo = 'CARGO' then monto else -monto end),
    0
  )
  from public.cobranzas
  where cliente_id = p_cliente_id;
$$;

-- Monto esperado en caja al cierre
create or replace function caja_monto_esperado(p_sesion_id bigint)
returns numeric language sql stable as $$
  select
    cs.monto_apertura
    + coalesce((
        select sum(vp.monto)
        from public.venta_pagos vp
        join public.ventas v on v.id = vp.venta_id
        where v.caja_sesion_id = p_sesion_id
          and vp.metodo = 'EFECTIVO'
          and v.estado = 'completada'
      ), 0)
    + coalesce((
        select sum(monto)
        from public.caja_movimientos
        where sesion_id = p_sesion_id and tipo = 'ingreso'
      ), 0)
    - coalesce((
        select sum(monto)
        from public.caja_movimientos
        where sesion_id = p_sesion_id and tipo = 'egreso'
      ), 0)
  from public.caja_sesiones cs
  where cs.id = p_sesion_id;
$$;
