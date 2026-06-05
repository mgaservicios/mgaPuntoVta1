-- Agrega columnas faltantes en optica_orden_items y optica_ordenes
-- Usar IF NOT EXISTS para que sea seguro correr múltiples veces

-- optica_orden_items: columnas que pueden estar ausentes si la tabla se creó sin la migración completa
ALTER TABLE optica_orden_items
  ADD COLUMN IF NOT EXISTS uso           text CHECK (uso IN ('lejos','cerca','ambos')),
  ADD COLUMN IF NOT EXISTS armazon_propio boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS articulo_id   bigint REFERENCES articulos(id),
  ADD COLUMN IF NOT EXISTS variante_id   bigint REFERENCES articulo_variantes(id),
  ADD COLUMN IF NOT EXISTS notas         text;

-- optica_ordenes: columnas de costo de trabajo y anticipo/seña
ALTER TABLE optica_ordenes
  ADD COLUMN IF NOT EXISTS costo_trabajo numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anticipo      numeric(12,2) NOT NULL DEFAULT 0;
