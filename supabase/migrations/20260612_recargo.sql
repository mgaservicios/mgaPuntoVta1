-- Columna recargo_monto en todas las tablas de documentos de venta
-- total = subtotal - descuento_monto + recargo_monto
ALTER TABLE ventas            ADD COLUMN IF NOT EXISTS recargo_monto numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE ordenes_venta     ADD COLUMN IF NOT EXISTS recargo_monto numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE optica_ordenes    ADD COLUMN IF NOT EXISTS recargo_monto numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE optica_servicios  ADD COLUMN IF NOT EXISTS recargo_monto numeric(10,2) NOT NULL DEFAULT 0;
