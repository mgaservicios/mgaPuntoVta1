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
