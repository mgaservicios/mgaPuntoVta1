-- Tabla de contadores por sucursal y tipo de documento
CREATE TABLE IF NOT EXISTS public.numeradores_sucursal (
  sucursal_id   bigint NOT NULL REFERENCES public.sucursales(id),
  tipo          text   NOT NULL,
  ultimo_numero bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (sucursal_id, tipo)
);

-- Función atómica: incrementa y devuelve el próximo número
-- Usa INSERT ... ON CONFLICT DO UPDATE para garantizar atomicidad sin race conditions
CREATE OR REPLACE FUNCTION public.next_numero_sucursal(
  p_sucursal_id bigint,
  p_tipo        text
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_numero bigint;
BEGIN
  INSERT INTO public.numeradores_sucursal (sucursal_id, tipo, ultimo_numero)
  VALUES (p_sucursal_id, p_tipo, 1)
  ON CONFLICT (sucursal_id, tipo) DO UPDATE
    SET ultimo_numero = numeradores_sucursal.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_numero;
  RETURN v_numero;
END;
$$;
