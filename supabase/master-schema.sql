-- ============================================================
-- MGA Platform — Master Schema
-- Agregar al proyecto Supabase principal (plataforma)
-- ============================================================

-- Registro de empresas/tenants
create table if not exists public.empresas (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text not null,
  codigo               text unique not null,
  activo               boolean default true,
  supabase_url         text not null,
  supabase_anon_key    text not null,
  supabase_service_key text not null,
  created_at           timestamptz default now()
);

alter table public.empresas enable row level security;
create policy "empresas_service_role_all" on public.empresas
  for all using (auth.role() = 'service_role');

-- Módulos activos por empresa
create table if not exists public.empresa_modulos (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  modulo     text not null,
  activo     boolean default true,
  primary key (empresa_id, modulo)
);

alter table public.empresa_modulos enable row level security;
create policy "empresa_modulos_service_role_all" on public.empresa_modulos
  for all using (auth.role() = 'service_role');

-- ============================================================
-- Módulos válidos: ventas, inventario, caja, contactos,
--                  finanzas, administracion
-- ============================================================
