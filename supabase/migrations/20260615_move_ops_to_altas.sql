-- Mover operaciones de admin → altas: listas_precio, vendedores, formas_pago
UPDATE public.role_permissions
SET operation = 'altas.' || substring(operation FROM 7)
WHERE operation LIKE 'admin.listas_precio.%'
   OR operation LIKE 'admin.vendedores.%'
   OR operation LIKE 'admin.formas_pago.%';
