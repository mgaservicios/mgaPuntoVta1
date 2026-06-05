-- Permite guardar precios de listas adicionales (venta, etc.) junto con el costo del remito
ALTER TABLE remito_items ADD COLUMN IF NOT EXISTS precios_extras JSONB DEFAULT NULL;
-- Estructura: [{"lista_precio_id": 3, "precio": 150.00}, ...]
