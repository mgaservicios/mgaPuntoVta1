-- ============================================================
-- pendientes_aplicar.sql
-- Aplicar en Orden en Supabase SQL Editor (seguro por idempotencia)
-- ============================================================

-- >>> 20260603_eliminaciones_log.sql >>>
-- Log de eliminaciones: OT, órdenes de venta, ventas (POS) y remitos
-- Solo administradores pueden eliminar; queda registrado con datos snapshot.

CREATE TABLE IF NOT EXISTS public.eliminaciones_log (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo           text NOT NULL CHECK (tipo IN ('optica_ot', 'orden_venta', 'venta', 'remito')),
  referencia_id  bigint NOT NULL,
  numero         text,
  cliente_nombre text,
  total          numeric(12,2),
  fecha_documento date,
  sucursal_id    bigint REFERENCES public.sucursales(id),
  estado_previo  text,
  usuario_id     uuid NOT NULL REFERENCES auth.users(id),
  datos_extra    jsonb,
  eliminado_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eliminaciones_log_tipo_idx
  ON public.eliminaciones_log (tipo, eliminado_at DESC);
CREATE INDEX IF NOT EXISTS eliminaciones_log_sucursal_idx
  ON public.eliminaciones_log (sucursal_id, eliminado_at DESC);
CREATE INDEX IF NOT EXISTS eliminaciones_log_usuario_idx
  ON public.eliminaciones_log (usuario_id, eliminado_at DESC);

-- >>> 20260603_remito_precios_extras.sql >>>
-- Permite guardar precios de listas adicionales (venta, etc.) junto con el costo del remito
ALTER TABLE remito_items ADD COLUMN IF NOT EXISTS precios_extras JSONB DEFAULT NULL;
-- Estructura: [{"lista_precio_id": 3, "precio": 150.00}, ...]

-- >>> 20260711_caja_cierre_historial.sql >>>
-- 20260711_caja_cierre_historial.sql
-- Manejo de cierre de cajas, sesiones encadenadas, historial por día y anulación de movimientos

-- ============================================================
-- 1. Campo fecha en caja_sesiones (agrupar por día calendario)
-- ============================================================

ALTER TABLE public.caja_sesiones
  ADD COLUMN IF NOT EXISTS fecha date DEFAULT CURRENT_DATE;

-- Migrar datos existentes
UPDATE public.caja_sesiones
SET fecha = fecha_apertura::date
WHERE fecha IS NULL;

ALTER TABLE public.caja_sesiones
  ALTER COLUMN fecha SET NOT NULL;

-- ============================================================
-- 2. Campo sesion_anterior_id (encadenar sesiones)
-- ============================================================

ALTER TABLE public.caja_sesiones
  ADD COLUMN IF NOT EXISTS sesion_anterior_id bigint
  REFERENCES public.caja_sesiones(id);

-- ============================================================
-- 3. Tabla de auditoría caja_movimientos_log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.caja_movimientos_log (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  movimiento_id     bigint NOT NULL,
  sesion_id         bigint NOT NULL,
  accion            text NOT NULL CHECK (accion IN ('anulacion')),
  tipo              text NOT NULL,
  tipo_concepto     text,
  concepto          text NOT NULL,
  monto             numeric(12,2) NOT NULL,
  usuario_original  uuid NOT NULL,
  motivo            text NOT NULL,
  usuario_anula     uuid NOT NULL REFERENCES public.users(id),
  created_at        timestamptz DEFAULT now()
);

-- Grants
GRANT ALL ON TABLE public.caja_movimientos_log TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.caja_movimientos_log_id_seq TO anon, authenticated, service_role;

-- ============================================================
-- 4. Permiso fondos.caja.anular
-- ============================================================

INSERT INTO public.role_permissions (role_id, operation, allowed)
SELECT r.id, 'fondos.caja.anular',
  CASE WHEN r.name = 'Administrador' THEN true ELSE false END
FROM public.roles r
ON CONFLICT (role_id, operation) DO NOTHING;

-- ============================================================
-- 5. Índices para mejorar performance
-- ============================================================

CREATE INDEX IF NOT EXISTS caja_sesiones_fecha_idx
  ON public.caja_sesiones (fecha);

CREATE INDEX IF NOT EXISTS caja_movimientos_sesion_id_idx
  ON public.caja_movimientos (sesion_id);

CREATE INDEX IF NOT EXISTS caja_movimientos_created_at_idx
  ON public.caja_movimientos (created_at);

-- >>> 20260712_fix_caja_monto_esperado.sql >>>
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

-- >>> 20260723_reset_stock_precios.sql >>>
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
DECLARE
  v_tables text[] := ARRAY['precio_lotes', 'precios'];
  v_existing text[] := '{}';
  v_table text;
BEGIN
  -- Filtrar solo las tablas que existen en este tenant
  FOREACH v_table IN ARRAY v_tables LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = v_table) THEN
      v_existing := array_append(v_existing, 'public.' || v_table);
    END IF;
  END LOOP;

  -- TRUNCATE dinámico solo con las tablas existentes
  IF array_length(v_existing, 1) > 0 THEN
    EXECUTE 'TRUNCATE TABLE ' || array_to_string(v_existing, ', ') || ' RESTART IDENTITY CASCADE';
  END IF;

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

-- >>> 20260728_restore_backup.sql >>>
-- Función para truncar TODAS las tablas de datos (excepto users) antes de restaurar backup.
-- Usa TRUNCATE ... CASCADE para manejar dependencias FK automáticamente.
-- Solo service_role puede ejecutarla.

CREATE OR REPLACE FUNCTION public.restore_backup_truncate()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables text[] := ARRAY[
    'variante_atributos',
    'articulo_variantes',
    'precios',
    'articulo_stock',
    'movimientos_stock',
    'remito_items',
    'remitos',
    'orden_venta_items',
    'orden_venta_pagos',
    'ordenes_venta',
    'venta_items',
    'venta_pagos',
    'ventas',
    'caja_movimientos',
    'caja_sesiones',
    'cobranzas',
    'notas_credito',
    'eliminaciones_log',
    'optica_orden_items',
    'optica_orden_pagos',
    'optica_orden_tareas',
    'optica_ordenes',
    'optica_servicio_pagos',
    'optica_servicio_tareas',
    'optica_servicios',
    'optica_medicos',
    'articulos',
    'formas_pago_cuotas',
    'formas_pago',
    'listas_precio',
    'vendedores',
    'proveedores',
    'marcas',
    'subcategorias',
    'categorias',
    'clientes',
    'sucursales',
    'parametros',
    'atributo_tipos',
    'unidades_medida'
  ];
  v_existing text[] := '{}';
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = v_table) THEN
      v_existing := array_append(v_existing, 'public.' || v_table);
    END IF;
  END LOOP;

  IF array_length(v_existing, 1) > 0 THEN
    EXECUTE 'TRUNCATE TABLE ' || array_to_string(v_existing, ', ') || ' RESTART IDENTITY CASCADE';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_backup_truncate() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_backup_truncate() FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_backup_truncate() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.restore_backup_truncate() TO service_role;
