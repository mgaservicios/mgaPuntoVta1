ALTER TABLE optica_servicio_tipos
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_proceso', 'terminado'));
