-- Schema para la BD maestra de la app MGA
-- Ejecutar en el Supabase de la app MGA (NO en el tenant)
--
-- Este schema es consumido por mga-ptoventa para:
--   1. Resolver empresa por código en el login (auth.ts)
--   2. Obtener supabase_url + keys del tenant (supabase-tenant.ts)
--   3. Obtener módulos habilitados del tenant (auth.ts)

create table public.empresas (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  codigo                text unique not null,          -- código de acceso del tenant (ej: "FARMACIA2025")
  activo                boolean default true,
  supabase_url          text not null,                 -- URL del proyecto Supabase del tenant
  supabase_anon_key     text not null,                 -- anon key del tenant
  supabase_service_key  text not null,                 -- service role key del tenant
  -- Datos comerciales
  razon_social          text,
  cuit                  text,
  telefono              text,
  email                 text,
  direccion             text,
  localidad             text,
  plan                  text default 'basico',          -- basico | profesional | enterprise
  fecha_inicio          date,
  fecha_vencimiento     date,
  -- Seguimiento de implementación
  estado_implementacion text default 'en_progreso',    -- en_progreso | activo | pausado | suspendido
  notas                 text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create table public.empresa_modulos (
  empresa_id  uuid    not null references public.empresas(id) on delete cascade,
  modulo      text    not null,   -- ventas | inventario | caja | contactos | finanzas | administracion
  activo      boolean default true,
  primary key (empresa_id, modulo)
);
