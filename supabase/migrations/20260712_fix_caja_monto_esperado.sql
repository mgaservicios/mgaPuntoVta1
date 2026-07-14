-- 20260712_fix_caja_monto_esperado.sql
-- Fix: eliminar doble conteo en caja_monto_esperado
--
-- PROBLEMA: La función sumaba venta_pagos EFECTIVO + caja_movimientos ingreso.
-- Pero la ruta de Ventas POS inserta en AMBAS tablas para cada pago no-CC/no-NC.
-- Resultado: un pago de $100 se contaba como $200 al cerrar.
--
-- SOLUCIÓN: Eliminar la subquery de venta_pagos. La función ahora solo suma
-- caja_movimientos (que ya incluye todos los pagos: EFECTIVO, TRANSFERENCIA, etc.)

CREATE OR REPLACE FUNCTION public.caja_monto_esperado(p_sesion_id bigint)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT
    cs.monto_apertura
    + COALESCE((
        SELECT SUM(monto)
        FROM public.caja_movimientos
        WHERE sesion_id = p_sesion_id AND tipo = 'ingreso'
      ), 0)
    - COALESCE((
        SELECT SUM(monto)
        FROM public.caja_movimientos
        WHERE sesion_id = p_sesion_id AND tipo = 'egreso'
      ), 0)
  FROM public.caja_sesiones cs
  WHERE cs.id = p_sesion_id;
$$;
