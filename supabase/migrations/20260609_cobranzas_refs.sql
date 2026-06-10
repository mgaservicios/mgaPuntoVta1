-- Agrega referencias a documentos origen en la tabla cobranzas
-- Permite trazar qué OV, OT o SV generó cada CARGO/PAGO
ALTER TABLE cobranzas
  ADD COLUMN IF NOT EXISTS orden_id           bigint REFERENCES ordenes_venta(id),
  ADD COLUMN IF NOT EXISTS optica_orden_id    bigint REFERENCES optica_ordenes(id),
  ADD COLUMN IF NOT EXISTS optica_servicio_id bigint REFERENCES optica_servicios(id);

CREATE INDEX IF NOT EXISTS idx_cobranzas_orden_id           ON cobranzas(orden_id);
CREATE INDEX IF NOT EXISTS idx_cobranzas_optica_orden_id    ON cobranzas(optica_orden_id);
CREATE INDEX IF NOT EXISTS idx_cobranzas_optica_servicio_id ON cobranzas(optica_servicio_id);
