-- Función para limpiar todo el stock de una sucursal específica.
-- Pone stock_actual=0 y stock_minimo=0 en articulo_stock,
-- elimina movimientos_stock de esa sucursal,
-- y recalcula los valores cached en articulos y articulo_variantes.
-- Solo service_role puede ejecutarla.

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

-- Función para eliminar todos los precios y precio_lotes,
-- y limpiar los precios cached en articulos y articulo_variantes.
-- Solo service_role puede ejecutarla.

CREATE OR REPLACE FUNCTION public.reset_precios()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Delete all batch price logs
  DELETE FROM public.precio_lotes;

  -- 2. Delete all price history
  DELETE FROM public.precios;

  -- 3. Clear cached prices on articulos
  UPDATE public.articulos
  SET precio_venta = NULL,
      precio_compra = NULL,
      updated_at = now();

  -- 4. Clear cached prices on articulo_variantes
  UPDATE public.articulo_variantes
  SET precio_venta = NULL,
      precio_compra = NULL,
      updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_precios() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_precios() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_precios() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.reset_precios() TO service_role;
