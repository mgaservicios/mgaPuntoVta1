-- Agrega costo de trabajo manual y anticipo/seña a las órdenes de óptica
ALTER TABLE optica_ordenes
  ADD COLUMN IF NOT EXISTS costo_trabajo numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anticipo      numeric(12,2) NOT NULL DEFAULT 0;
