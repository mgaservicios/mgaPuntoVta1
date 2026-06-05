-- Corrige la constraint tipo_check de optica_orden_items
-- (puede haberse creado con valores diferentes en el DB original)
ALTER TABLE optica_orden_items
  DROP CONSTRAINT IF EXISTS optica_orden_items_tipo_check;

ALTER TABLE optica_orden_items
  ADD CONSTRAINT optica_orden_items_tipo_check
  CHECK (tipo IN ('armazon', 'cristal', 'tratamiento', 'otro'));
