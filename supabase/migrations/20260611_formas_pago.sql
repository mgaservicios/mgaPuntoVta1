-- ── Tablas ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS formas_pago (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     text NOT NULL,
  tipo       text NOT NULL CHECK (tipo IN ('TARJETA_CREDITO','TARJETA_DEBITO','BANCARIA','BILLETERA','MONEDA')),
  activo     boolean NOT NULL DEFAULT true,
  orden      int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS formas_pago_cuotas (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  forma_pago_id   bigint NOT NULL REFERENCES formas_pago(id) ON DELETE CASCADE,
  cantidad_cuotas int NOT NULL CHECK (cantidad_cuotas >= 1),
  recargo_pct     numeric(5,2) NOT NULL DEFAULT 0,
  UNIQUE(forma_pago_id, cantidad_cuotas)
);

-- ── Seed inicial ──────────────────────────────────────────────────────────────

INSERT INTO formas_pago (nombre, tipo, orden) VALUES
  ('Efectivo',       'MONEDA',          1),
  ('Transferencia',  'BANCARIA',        2),
  ('Cheque',         'BANCARIA',        3),
  ('Tarjeta Débito', 'TARJETA_DEBITO',  4),
  ('Tarjeta Crédito','TARJETA_CREDITO', 5)
ON CONFLICT DO NOTHING;

-- ── Ampliar tablas de pago ────────────────────────────────────────────────────

ALTER TABLE venta_pagos
  ADD COLUMN IF NOT EXISTS forma_pago_id bigint REFERENCES formas_pago(id),
  ADD COLUMN IF NOT EXISTS cuotas        int,
  ADD COLUMN IF NOT EXISTS fecha_pago    date;

ALTER TABLE optica_orden_pagos
  ADD COLUMN IF NOT EXISTS forma_pago_id bigint REFERENCES formas_pago(id),
  ADD COLUMN IF NOT EXISTS cuotas        int;

ALTER TABLE optica_servicio_pagos
  ADD COLUMN IF NOT EXISTS forma_pago_id bigint REFERENCES formas_pago(id),
  ADD COLUMN IF NOT EXISTS cuotas        int;

ALTER TABLE orden_venta_pagos
  ADD COLUMN IF NOT EXISTS forma_pago_id bigint REFERENCES formas_pago(id),
  ADD COLUMN IF NOT EXISTS cuotas        int;

-- ── Liberar CHECK en metodo (texto libre para nombres personalizados) ─────────

ALTER TABLE venta_pagos           DROP CONSTRAINT IF EXISTS venta_pagos_metodo_check;
ALTER TABLE optica_orden_pagos    DROP CONSTRAINT IF EXISTS optica_orden_pagos_metodo_check;
ALTER TABLE optica_servicio_pagos DROP CONSTRAINT IF EXISTS optica_servicio_pagos_metodo_check;
ALTER TABLE orden_venta_pagos     DROP CONSTRAINT IF EXISTS orden_venta_pagos_metodo_check;
