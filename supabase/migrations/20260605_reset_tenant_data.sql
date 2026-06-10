-- Función para resetear todos los datos operativos de un tenant.
-- Conserva: users, user_sucursales, sucursales, roles, role_permissions,
--            unidades_medida, atributo_tipos,
--            formas_pago, formas_pago_cuotas, listas_precio, categorias
-- Solo service_role puede ejecutarla.
-- Usa SQL dinámico para ignorar tablas que aún no existen en el tenant.

CREATE OR REPLACE FUNCTION public.reset_tenant_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables text[] := ARRAY[
    'optica_orden_pagos',
    'optica_orden_tareas',
    'optica_orden_items',
    'optica_ordenes',
    'optica_medicos',
    'eliminaciones_log',
    'venta_pagos',
    'venta_items',
    'cobranzas',
    'movimientos_stock',
    'notas_credito',
    'ventas',
    'caja_movimientos',
    'caja_sesiones',
    'orden_venta_pagos',
    'orden_venta_items',
    'ordenes_venta',
    'remito_items',
    'remitos',
    'articulo_stock',
    'precios',
    'variante_atributos',
    'articulo_variantes',
    'articulos',
    'subcategorias',
    'marcas',
    'proveedores',
    'clientes'
  ];
  v_existing text[] := '{}';
  v_table text;
BEGIN
  -- Filtrar solo las tablas que existen en este tenant
  FOREACH v_table IN ARRAY v_tables LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = v_table) THEN
      v_existing := array_append(v_existing, 'public.' || v_table);
    END IF;
  END LOOP;

  -- Ejecutar TRUNCATE dinámico solo con las tablas existentes
  IF array_length(v_existing, 1) > 0 THEN
    EXECUTE 'TRUNCATE TABLE ' || array_to_string(v_existing, ', ') || ' RESTART IDENTITY CASCADE';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_tenant_data() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_tenant_data() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_tenant_data() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.reset_tenant_data() TO service_role;
