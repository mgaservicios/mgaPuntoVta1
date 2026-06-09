-- Tabla unidades_medida
create table if not exists public.unidades_medida (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  activo     boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Agregar unique constraint si no existe (la tabla pudo haberse creado sin él)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.unidades_medida'::regclass
      and contype = 'u'
      and conname = 'unidades_medida_nombre_key'
  ) then
    alter table public.unidades_medida add constraint unidades_medida_nombre_key unique (nombre);
  end if;
end;
$$;

-- Unidades por defecto (safe insert sin depender de ON CONFLICT hasta tener el constraint)
insert into public.unidades_medida (nombre)
select u.nombre
from (values
  ('Unidad'), ('Kg'), ('Gr'), ('Lt'), ('Ml'),
  ('Caja'), ('Bolsa'), ('Metro'), ('Par')
) as u(nombre)
where not exists (
  select 1 from public.unidades_medida m where lower(m.nombre) = lower(u.nombre)
);

-- Columna unidad_id en articulos (si no existe)
alter table public.articulos
  add column if not exists unidad_id bigint references public.unidades_medida(id);

-- Migrar datos del campo unidad (text) al nuevo unidad_id, si la columna vieja existe
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'articulos' and column_name = 'unidad'
  ) then
    update public.articulos a
    set unidad_id = u.id
    from public.unidades_medida u
    where lower(a.unidad) = lower(u.nombre)
      and a.unidad_id is null;

    alter table public.articulos drop column unidad;
  end if;
end;
$$;
