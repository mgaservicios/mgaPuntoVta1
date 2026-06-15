-- Renombrar operaciones del módulo caja → fondos en role_permissions
UPDATE public.role_permissions
SET operation = 'fondos.' || substring(operation FROM 6)
WHERE operation LIKE 'caja.%';

-- Agregar fondos.recibos.ver para todos los roles existentes
INSERT INTO public.role_permissions (role_id, operation, allowed)
SELECT r.id, 'fondos.recibos.ver',
  CASE WHEN r.name = 'Administrador' THEN true ELSE false END
FROM public.roles r
ON CONFLICT (role_id, operation) DO NOTHING;
