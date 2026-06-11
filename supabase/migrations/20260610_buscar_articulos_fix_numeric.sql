-- buscar_articulos con prioridad exclusiva:
-- 1. Exacto en codigo o codigo_barras → solo esos
-- 2. Sino → parcial (ILIKE '%...%') en codigo o nombre
create or replace function buscar_articulos(p_query text, p_limit int default 20)
returns table (
  id            bigint,
  codigo        text,
  nombre        text,
  tipo_articulo text,
  precio_venta  numeric,
  stock_actual  numeric,
  imagen_url    text
)
language sql stable as $$
  select a.id, a.codigo, a.nombre, a.tipo_articulo, a.precio_venta, a.stock_actual, a.imagen_url
  from public.articulos a
  where a.activo = true
    and (
      a.codigo           ilike p_query
      or a.codigo_barras ilike p_query
      or (
        not exists (
          select 1 from public.articulos a2
          where a2.activo = true
            and (a2.codigo ilike p_query or a2.codigo_barras ilike p_query)
        )
        and (
          a.codigo  ilike '%' || p_query || '%'
          or a.nombre ilike '%' || p_query || '%'
        )
      )
    )
  order by
    case
      when a.codigo        ilike p_query             then 0
      when a.codigo_barras ilike p_query             then 1
      when a.codigo        ilike '%' || p_query || '%' then 2
      else 3
    end,
    a.nombre
  limit p_limit;
$$;
