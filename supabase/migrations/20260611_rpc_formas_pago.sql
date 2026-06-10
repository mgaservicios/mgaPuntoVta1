-- Actualizar RPCs para incluir forma_pago_id, cuotas y fecha_pago
-- (requiere haber corrido 20260611_formas_pago.sql primero)

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: venta_pagos + cobranzas CARGO en una sola transacción (v2)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION registrar_pagos_venta(
  p_venta_id    int,
  p_cliente_id  int,
  p_fecha       date,
  p_numero      text,
  p_sucursal_id int,
  p_usuario_id  uuid,
  p_pagos       jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_pago     jsonb;
  v_cc_monto numeric := 0;
BEGIN
  FOR v_pago IN SELECT * FROM jsonb_array_elements(p_pagos) LOOP
    INSERT INTO venta_pagos (venta_id, metodo, monto, referencia, nota_credito_id, forma_pago_id, cuotas, fecha_pago)
    VALUES (
      p_venta_id,
      v_pago->>'metodo',
      (v_pago->>'monto')::numeric,
      NULLIF(v_pago->>'referencia', ''),
      (v_pago->>'nota_credito_id')::int,
      (v_pago->>'forma_pago_id')::bigint,
      (v_pago->>'cuotas')::int,
      COALESCE((v_pago->>'fecha_pago')::date, p_fecha)
    );
    IF v_pago->>'metodo' = 'CUENTA_CORRIENTE' THEN
      v_cc_monto := v_cc_monto + (v_pago->>'monto')::numeric;
    END IF;
  END LOOP;

  IF v_cc_monto > 0 AND p_cliente_id IS NOT NULL THEN
    INSERT INTO cobranzas (cliente_id, venta_id, tipo, monto, fecha, descripcion, sucursal_id, usuario_id)
    VALUES (p_cliente_id, p_venta_id, 'CARGO', v_cc_monto, p_fecha, 'Venta ' || p_numero, p_sucursal_id, p_usuario_id);
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: optica_orden_pagos + cobranzas CARGO (v2)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION registrar_pago_optica_orden(
  p_orden_id       int,
  p_caja_sesion_id int,
  p_metodo         text,
  p_monto          numeric,
  p_concepto       text,
  p_referencia     text,
  p_fecha_pago     date,
  p_usuario_id     uuid,
  p_cliente_id     int,
  p_sucursal_id    int,
  p_numero         text,
  p_forma_pago_id  bigint DEFAULT NULL,
  p_cuotas         int    DEFAULT NULL
) RETURNS json LANGUAGE plpgsql AS $$
DECLARE
  v_id   int;
  v_pago json;
BEGIN
  INSERT INTO optica_orden_pagos
    (orden_id, caja_sesion_id, metodo, monto, concepto, referencia, fecha_pago, usuario_id, forma_pago_id, cuotas)
  VALUES
    (p_orden_id, p_caja_sesion_id, p_metodo, p_monto, p_concepto, NULLIF(p_referencia, ''), p_fecha_pago, p_usuario_id, p_forma_pago_id, p_cuotas)
  RETURNING id INTO v_id;

  SELECT row_to_json(t) INTO v_pago FROM optica_orden_pagos t WHERE id = v_id;

  IF p_metodo = 'CUENTA_CORRIENTE' AND p_cliente_id IS NOT NULL THEN
    INSERT INTO cobranzas
      (cliente_id, tipo, monto, fecha, descripcion, sucursal_id, optica_orden_id, usuario_id)
    VALUES
      (p_cliente_id, 'CARGO', p_monto, p_fecha_pago, 'OT ' || p_numero, p_sucursal_id, p_orden_id, p_usuario_id);
  END IF;

  RETURN v_pago;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: optica_servicio_pagos + cobranzas CARGO (v2)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION registrar_pago_optica_servicio(
  p_servicio_id    int,
  p_caja_sesion_id int,
  p_metodo         text,
  p_monto          numeric,
  p_concepto       text,
  p_referencia     text,
  p_fecha_pago     date,
  p_usuario_id     uuid,
  p_cliente_id     int,
  p_sucursal_id    int,
  p_numero         text,
  p_forma_pago_id  bigint DEFAULT NULL,
  p_cuotas         int    DEFAULT NULL
) RETURNS json LANGUAGE plpgsql AS $$
DECLARE
  v_id   int;
  v_pago json;
BEGIN
  INSERT INTO optica_servicio_pagos
    (servicio_id, caja_sesion_id, metodo, monto, concepto, referencia, fecha_pago, usuario_id, forma_pago_id, cuotas)
  VALUES
    (p_servicio_id, p_caja_sesion_id, p_metodo, p_monto, p_concepto, NULLIF(p_referencia, ''), p_fecha_pago, p_usuario_id, p_forma_pago_id, p_cuotas)
  RETURNING id INTO v_id;

  SELECT row_to_json(t) INTO v_pago FROM optica_servicio_pagos t WHERE id = v_id;

  IF p_metodo = 'CUENTA_CORRIENTE' AND p_cliente_id IS NOT NULL THEN
    INSERT INTO cobranzas
      (cliente_id, tipo, monto, fecha, descripcion, sucursal_id, optica_servicio_id, usuario_id)
    VALUES
      (p_cliente_id, 'CARGO', p_monto, p_fecha_pago, 'SV ' || p_numero, p_sucursal_id, p_servicio_id, p_usuario_id);
  END IF;

  RETURN v_pago;
END;
$$;
