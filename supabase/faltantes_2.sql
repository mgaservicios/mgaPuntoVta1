-- faltantes_2.sql
-- 1) Diagnostica las 2 funciones que siguen dando NO en el check
-- 2) Las recrea (CREATE OR REPLACE, idempotente, no borra datos)
-- Pegar en Supabase SQL Editor. Copiar el resultado del SELECT y cualquier error.

-- ============================================================
-- DIAGNÓSTICO: firmas reales de las funciones
-- ============================================================
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS firma,
       p.prosecdef,
       n.nspname AS schema
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('caja_monto_esperado', 'reset_stock_sucursal')
ORDER BY p.proname;

-- ============================================================
-- APLICAR: 20260712_fix_caja_monto_esperado
-- ============================================================
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

-- ============================================================
-- APLICAR: 20260723_reset_stock_precios (sección reset_stock_sucursal)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_stock_sucursal(p_sucursal_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Zero out stock for this sucursal
  UPDATE public.articulo_stock
  SET stock_actual = 0,
      stock_minimo = 0,
      updated_at = now()
  WHERE sucursal_id = p_sucursal_id;

  -- 2. Delete stock movements for this sucursal
  DELETE FROM public.movimientos_stock
  WHERE sucursal_id = p_sucursal_id;

  -- 3. Recalculate cached stock on articulo_variantes
  UPDATE public.articulo_variantes av
  SET stock_actual = COALESCE(sub.total, 0),
      stock_minimo = COALESCE(sub.total_min, 0),
      updated_at = now()
  FROM (
    SELECT variante_id,
           SUM(stock_actual) AS total,
           SUM(stock_minimo) AS total_min
    FROM public.articulo_stock
    WHERE variante_id IS NOT NULL
    GROUP BY variante_id
  ) sub
  WHERE av.id = sub.variante_id;

  -- 4. Zero out variantes that have no stock rows left
  UPDATE public.articulo_variantes
  SET stock_actual = 0,
      stock_minimo = 0,
      updated_at = now()
  WHERE id NOT IN (
    SELECT DISTINCT variante_id FROM public.articulo_stock
    WHERE variante_id IS NOT NULL
  );

  -- 5. Recalculate cached stock on articulos
  UPDATE public.articulos a
  SET stock_actual = COALESCE(sub.total, 0),
      stock_minimo = COALESCE(sub.total_min, 0),
      updated_at = now()
  FROM (
    SELECT as2.articulo_id,
           SUM(as2.stock_actual) AS total,
           SUM(as2.stock_minimo) AS total_min
    FROM public.articulo_stock as2
    LEFT JOIN public.articulo_variantes av ON av.id = as2.variante_id
    WHERE as2.variante_id IS NULL
    GROUP BY as2.articulo_id
  ) sub
  WHERE a.id = sub.articulo_id;

  -- Zero out simple articles with no stock rows
  UPDATE public.articulos
  SET stock_actual = 0,
      stock_minimo = 0,
      updated_at = now()
  WHERE tipo_articulo = 'simple'
    AND id NOT IN (
      SELECT DISTINCT articulo_id FROM public.articulo_stock
      WHERE variante_id IS NULL
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_stock_sucursal(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_stock_sucursal(bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_stock_sucursal(bigint) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.reset_stock_sucursal(bigint) TO service_role;

-- ============================================================
-- VERIFICACIÓN FINAL (debe devolver 2 filas con firma 'bigint')
-- ============================================================
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS firma
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('caja_monto_esperado', 'reset_stock_sucursal')
ORDER BY p.proname;