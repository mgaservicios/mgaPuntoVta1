-- Inserta las operaciones que faltaban en perm-groups.ts para todos los roles existentes.
-- Usa ON CONFLICT DO NOTHING para no pisar lo que ya esté configurado.

INSERT INTO public.role_permissions (role_id, operation, allowed)
SELECT r.id, op.operation, false
FROM public.roles r
CROSS JOIN (VALUES
  ('optica.servicios.ver'),
  ('optica.servicios.crear'),
  ('optica.servicios.editar'),
  ('optica.servicios.anular'),
  ('admin.vendedores.ver'),
  ('admin.vendedores.crear'),
  ('admin.vendedores.editar'),
  ('admin.formas_pago.ver'),
  ('admin.formas_pago.crear'),
  ('admin.formas_pago.editar'),
  ('admin.formas_pago.eliminar')
) AS op(operation)
ON CONFLICT (role_id, operation) DO NOTHING;
