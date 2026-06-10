-- Paso 1: columnas de refs (de cobranzas_refs, puede que ya existan)
ALTER TABLE cobranzas
  ADD COLUMN IF NOT EXISTS orden_id           bigint REFERENCES ordenes_venta(id),
  ADD COLUMN IF NOT EXISTS optica_orden_id    bigint REFERENCES optica_ordenes(id),
  ADD COLUMN IF NOT EXISTS optica_servicio_id bigint REFERENCES optica_servicios(id);

CREATE INDEX IF NOT EXISTS idx_cobranzas_orden_id           ON cobranzas(orden_id);
CREATE INDEX IF NOT EXISTS idx_cobranzas_optica_orden_id    ON cobranzas(optica_orden_id);
CREATE INDEX IF NOT EXISTS idx_cobranzas_optica_servicio_id ON cobranzas(optica_servicio_id);

-- Paso 2: columna sucursal_id
ALTER TABLE cobranzas
  ADD COLUMN IF NOT EXISTS sucursal_id bigint REFERENCES sucursales(id);

CREATE INDEX IF NOT EXISTS idx_cobranzas_sucursal_id ON cobranzas(sucursal_id);

-- Paso 3: backfill desde documentos origen
UPDATE cobranzas c SET sucursal_id = v.sucursal_id
FROM ventas v WHERE c.venta_id = v.id AND c.sucursal_id IS NULL;

UPDATE cobranzas c SET sucursal_id = o.sucursal_id
FROM ordenes_venta o WHERE c.orden_id = o.id AND c.sucursal_id IS NULL;

UPDATE cobranzas c SET sucursal_id = oo.sucursal_id
FROM optica_ordenes oo WHERE c.optica_orden_id = oo.id AND c.sucursal_id IS NULL;

UPDATE cobranzas c SET sucursal_id = s.sucursal_id
FROM optica_servicios s WHERE c.optica_servicio_id = s.id AND c.sucursal_id IS NULL;
