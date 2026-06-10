-- ============================================================
-- Módulo: Gestión de Servicios Óptica
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- ============================================================

-- Servicios (cabecera)
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

-- Tipos de reparación por servicio
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
  precio      numeric(12,2) DEFAULT 0,
  estado      text NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','en_proceso','terminado'))
);

-- Tareas realizadas
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

-- Pagos
CREATE TABLE IF NOT EXISTS optica_servicio_pagos (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  servicio_id     bigint NOT NULL REFERENCES optica_servicios(id) ON DELETE CASCADE,
  caja_sesion_id  bigint REFERENCES caja_sesiones(id),
  metodo          text NOT NULL
                    CHECK (metodo IN (
                      'EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO',
                      'TARJETA_CREDITO','CUENTA_CORRIENTE','CHEQUE','OTRO'
                    )),
  monto           numeric(12,2) NOT NULL,
  concepto        text,
  referencia      text,
  fecha_pago      date DEFAULT CURRENT_DATE,
  usuario_id      uuid REFERENCES users(id),
  created_at      timestamptz DEFAULT now()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_optica_servicios_sucursal  ON optica_servicios(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_optica_servicios_cliente   ON optica_servicios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_optica_servicios_estado    ON optica_servicios(estado);
CREATE INDEX IF NOT EXISTS idx_optica_servicio_tipos_sv   ON optica_servicio_tipos(servicio_id);
CREATE INDEX IF NOT EXISTS idx_optica_servicio_tareas_sv  ON optica_servicio_tareas(servicio_id);
CREATE INDEX IF NOT EXISTS idx_optica_servicio_pagos_sv   ON optica_servicio_pagos(servicio_id);

-- RLS: habilitar y crear políticas para cada tabla
ALTER TABLE optica_servicios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE optica_servicio_tipos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE optica_servicio_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE optica_servicio_pagos  ENABLE ROW LEVEL SECURITY;

-- Políticas: acceso completo para usuarios autenticados
-- (ajustar según tu modelo de permisos si usás RLS granular)
CREATE POLICY "auth_full_optica_servicios"
  ON optica_servicios FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_full_optica_servicio_tipos"
  ON optica_servicio_tipos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_full_optica_servicio_tareas"
  ON optica_servicio_tareas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_full_optica_servicio_pagos"
  ON optica_servicio_pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);
