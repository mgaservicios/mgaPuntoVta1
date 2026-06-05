-- Tabla subcategorias
create table public.subcategorias (
  id           bigint generated always as identity primary key,
  nombre       text not null,
  categoria_id bigint not null references public.categorias(id) on delete cascade,
  activo       boolean not null default true,
  created_at   timestamptz default now(),
  unique (nombre, categoria_id)
);

-- Columna en articulos
alter table public.articulos
  add column subcategoria_id bigint references public.subcategorias(id);

-- Categoría "Varios" por defecto (si no existe)
insert into public.categorias (nombre) values ('Varios') on conflict (nombre) do nothing;
