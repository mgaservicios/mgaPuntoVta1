-- Módulo Óptica: órdenes de trabajo, médicos, ítems, tareas y pagos

-- Médicos que firman recetas
CREATE TABLE optica_medicos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  matricula text,
  telefono text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Orden de trabajo óptica
CREATE TABLE optica_ordenes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero text NOT NULL UNIQUE,
  fecha date DEFAULT current_date,
  fecha_prometida date,

  cliente_id bigint REFERENCES clientes(id),

  medico_id bigint REFERENCES optica_medicos(id),
  medico_nombre text,

  receta_url text,

  -- Graduación LEJOS
  lejos_od_esfera   numeric(6,2),
  lejos_od_cilindro numeric(6,2),
  lejos_od_eje      smallint,
  lejos_oi_esfera   numeric(6,2),
  lejos_oi_cilindro numeric(6,2),
  lejos_oi_eje      smallint,

  -- Graduación CERCA
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

  pedido_a      text,
  observaciones text,

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

-- Ítems de la orden
CREATE TABLE optica_orden_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id bigint NOT NULL REFERENCES optica_ordenes(id) ON DELETE CASCADE,
  tipo text NOT NULL
    CHECK (tipo IN ('armazon','cristal','tratamiento','otro')),
  -- Para armazón y cristal: a qué distancia aplica
  uso text CHECK (uso IN ('lejos','cerca','ambos')),
  nombre          text NOT NULL,
  armazon_propio  boolean DEFAULT false,  -- armazón traído por el cliente (no descuenta stock)
  articulo_id     bigint REFERENCES articulos(id),
  variante_id     bigint REFERENCES articulo_variantes(id),
  cantidad        numeric(10,3) NOT NULL DEFAULT 1,
  precio_unitario numeric(12,2) NOT NULL DEFAULT 0,
  descuento_pct   numeric(5,2)  DEFAULT 0,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  notas           text,
  created_at      timestamptz DEFAULT now()
);

-- Tareas de la orden
CREATE TABLE optica_orden_tareas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id    bigint NOT NULL REFERENCES optica_ordenes(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  descripcion text,
  estado      text DEFAULT 'en_proceso'
    CHECK (estado IN ('en_proceso','en_laboratorio','terminada')),
  fecha     date DEFAULT current_date,
  fecha_fin date,

  usuario_id uuid REFERENCES users(id),

  laboratorio_nombre text,
  laboratorio_tipo   text CHECK (laboratorio_tipo IN ('propio','externo')),

  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX ON optica_orden_tareas (orden_id);

-- Pagos integrados con caja
CREATE TABLE optica_orden_pagos (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id       bigint NOT NULL REFERENCES optica_ordenes(id) ON DELETE CASCADE,
  caja_sesion_id bigint REFERENCES caja_sesiones(id),
  metodo text NOT NULL
    CHECK (metodo IN ('EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO','TARJETA_CREDITO','CUENTA_CORRIENTE','CHEQUE','OTRO')),
  monto      numeric(12,2) NOT NULL,
  concepto   text,
  referencia text,
  fecha_pago date DEFAULT current_date,
  usuario_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX ON optica_orden_pagos (orden_id);

-- Habilitar módulo: INSERT INTO empresa_modulos (empresa_id, modulo, activo) VALUES (<id>, 'optica', true);
