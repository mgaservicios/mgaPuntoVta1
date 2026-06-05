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
