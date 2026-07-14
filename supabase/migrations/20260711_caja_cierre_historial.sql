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

INSERT INTO public.permisos (clave, nombre, modulo)
VALUES ('fondos.caja.anular', 'Anular movimientos de caja', 'fondos')
ON CONFLICT (clave) DO NOTHING;

-- ============================================================
-- 5. Índices para mejorar performance
-- ============================================================

CREATE INDEX IF NOT EXISTS caja_sesiones_fecha_idx
  ON public.caja_sesiones (fecha);

CREATE INDEX IF NOT EXISTS caja_movimientos_sesion_id_idx
  ON public.caja_movimientos (sesion_id);

CREATE INDEX IF NOT EXISTS caja_movimientos_created_at_idx
  ON public.caja_movimientos (created_at);
