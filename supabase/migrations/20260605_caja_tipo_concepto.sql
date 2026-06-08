-- Agrega tipo_concepto a caja_movimientos para separar la categoría del detalle libre
ALTER TABLE caja_movimientos
  ADD COLUMN IF NOT EXISTS tipo_concepto text;
