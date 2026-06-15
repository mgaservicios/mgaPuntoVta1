-- ============================================================
-- MGA Platform — Master Schema (BD de plataforma)
-- Ejecutar en el Supabase PRINCIPAL de la plataforma MGA
-- (NO en el tenant)
--
-- Consumido por mga-ptoventa para:
--   1. Resolver empresa por código en el login
--   2. Obtener supabase_url + keys del tenant
--   3. Obtener módulos habilitados del tenant
-- ============================================================

-- Registro de empresas / tenants
CREATE TABLE IF NOT EXISTS public.empresas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                text NOT NULL,
  codigo                text UNIQUE NOT NULL,         -- código de acceso (ej: "FARMACIA2025")
  activo                boolean DEFAULT true,
  supabase_url          text NOT NULL,                -- URL del proyecto Supabase del tenant
  supabase_anon_key     text NOT NULL,                -- anon key del tenant
  supabase_service_key  text NOT NULL,                -- service role key del tenant
  -- Datos comerciales
  razon_social          text,
  cuit                  text,
  telefono              text,
  email                 text,
  direccion             text,
  localidad             text,
  plan                  text DEFAULT 'basico',        -- basico | profesional | enterprise
  fecha_inicio          date,
  fecha_vencimiento     date,
  -- Seguimiento de implementación
  estado_implementacion text DEFAULT 'en_progreso',   -- en_progreso | activo | pausado | suspendido
  notas                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresas_service_role_all" ON public.empresas
  FOR ALL USING (auth.role() = 'service_role');

-- Módulos activos por empresa
-- Válidos: ventas | inventario | caja | contactos | finanzas | administracion | optica
CREATE TABLE IF NOT EXISTS public.empresa_modulos (
  empresa_id uuid    NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  modulo     text    NOT NULL,
  activo     boolean DEFAULT true,
  PRIMARY KEY (empresa_id, modulo)
);

ALTER TABLE public.empresa_modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa_modulos_service_role_all" ON public.empresa_modulos
  FOR ALL USING (auth.role() = 'service_role');
