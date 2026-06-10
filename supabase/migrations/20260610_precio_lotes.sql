-- Agrega tracking de lotes a la tabla de precios
ALTER TABLE precios ADD COLUMN IF NOT EXISTS lote_id uuid;
CREATE INDEX IF NOT EXISTS idx_precios_lote_id ON precios(lote_id);

-- Tabla de historial de actualizaciones masivas de precios
CREATE TABLE IF NOT EXISTS precio_lotes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_precio_id integer     NOT NULL,
  lista_nombre   text        NOT NULL,
  vigente_desde  date        NOT NULL,
  porcentaje     numeric(10,4) NOT NULL,
  signo          text        NOT NULL CHECK (signo IN ('aumento', 'descuento')),
  items_count    integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  estado         text        NOT NULL DEFAULT 'aplicado' CHECK (estado IN ('aplicado', 'revertido')),
  revertido_at   timestamptz,
  revertido_by   uuid
);

CREATE INDEX IF NOT EXISTS idx_precio_lotes_created ON precio_lotes(created_at DESC);
