-- Actualizar RPCs para soportar recargo_monto en optica_ordenes y optica_servicios
-- registrar_pagos_venta no necesita cambios: el INSERT de ventas se hace aparte en el route.

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: optica_orden_pagos + actualización de total con recargo (v3)
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
  p_forma_pago_id  bigint  DEFAULT NULL,
  p_cuotas         int     DEFAULT NULL,
  p_recargo_monto  numeric DEFAULT 0
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

  -- Aplicar recargo al total de la orden si se indicó
  IF p_recargo_monto IS DISTINCT FROM 0 AND p_recargo_monto IS NOT NULL THEN
    UPDATE optica_ordenes
    SET recargo_monto = p_recargo_monto,
        total         = total - recargo_monto + p_recargo_monto
    WHERE id = p_orden_id;
  END IF;

  RETURN v_pago;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: optica_servicio_pagos + actualización de total con recargo (v3)
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
  p_forma_pago_id  bigint  DEFAULT NULL,
  p_cuotas         int     DEFAULT NULL,
  p_recargo_monto  numeric DEFAULT 0
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

  -- Aplicar recargo al total del servicio si se indicó
  IF p_recargo_monto IS DISTINCT FROM 0 AND p_recargo_monto IS NOT NULL THEN
    UPDATE optica_servicios
    SET recargo_monto = p_recargo_monto,
        total         = total - recargo_monto + p_recargo_monto
    WHERE id = p_servicio_id;
  END IF;

  RETURN v_pago;
END;
$$;
