-- ═══════════════════════════════════════════════════════════════════════════
-- Consistencia de stock: Óptica (OT) + ventas
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Tipos de movimiento nuevos para salidas por OT y devoluciones por anulación.
-- 2. Los movimientos de venta deben poder borrarse junto con la venta.
-- 3. Marca de stock ya descontado en la OT (idempotencia + saber si revertir).
-- 4. RPCs transaccionales de descuento/reversión para los ítems de la OT.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tipos de movimiento
-- ─────────────────────────────────────────────────────────────────────────────
-- Se agregan tipos propios en vez de reutilizar 'devolucion' para que:
--   - la detección idempotente del backfill sea trivial (el 'tipo' es la marca)
--   - el historial distinga el origen de la devolución
--
--   'optica'          → salida de stock por orden de trabajo de óptica
--   'anulacion_venta' → devolución de stock por anulación de venta
--   'anulacion_ot'    → devolución de stock por anulación de OT de óptica
alter table public.movimientos_stock
  drop constraint if exists movimientos_stock_tipo_check;

alter table public.movimientos_stock
  add constraint movimientos_stock_tipo_check
  check (tipo in (
    'entrada','salida','ajuste','venta','devolucion','orden',
    'optica','anulacion_venta','anulacion_ot'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Movimientos de venta: permitir borrado en cascada
-- ─────────────────────────────────────────────────────────────────────────────
-- Hoy venta_id y venta_item_id son FK sin ON DELETE, y toda venta con stock
-- tiene movimientos, por lo que DELETE FROM ventas siempre fallaba con 500.
alter table public.movimientos_stock
  drop constraint if exists movimientos_stock_venta_id_fkey;

alter table public.movimientos_stock
  add constraint movimientos_stock_venta_id_fkey
  foreign key (venta_id) references public.ventas(id) on delete cascade;

alter table public.movimientos_stock
  drop constraint if exists movimientos_stock_venta_item_id_fkey;

alter table public.movimientos_stock
  add constraint movimientos_stock_venta_item_id_fkey
  foreign key (venta_item_id) references public.venta_items(id) on delete cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Marca de stock descontado en la OT
-- ─────────────────────────────────────────────────────────────────────────────
-- Sirve como flag de idempotencia de las RPCs y para saber si el PUT,
-- el DELETE o la anulación deben revertir.
alter table public.optica_ordenes
  add column if not exists stock_descontado_at timestamptz;

comment on column public.optica_ordenes.stock_descontado_at is
  'Momento en que se descontó el stock de los ítems con articulo_id. NULL = no descontado (o ya revertido).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Funciones de apoyo
-- ─────────────────────────────────────────────────────────────────────────────
-- Convención de signos: `cantidad` se guarda siempre positiva y el signo lo
-- determina el `tipo` (entrada/devolucion/anulacion_*/ajuste suman;
-- venta/orden/optica/salida restan). Espejo de TIPO_CONFIG en
-- app/(dashboard)/dashboard/consultas/seguimiento/page.tsx

-- Stock actual de (articulo, variante, sucursal), creando la fila si no existe.
-- Devuelve el stock previo al ajuste.
create or replace function public.stock_actual_o_crear(
  p_articulo_id  bigint,
  p_variante_id  bigint,
  p_sucursal_id  bigint
) returns numeric
language plpgsql
as $$
declare
  v_stock numeric;
begin
  select stock_actual into v_stock
  from public.articulo_stock
  where articulo_id = p_articulo_id
    and sucursal_id = p_sucursal_id
    and variante_id is not distinct from p_variante_id;

  if v_stock is null then
    insert into public.articulo_stock
      (articulo_id, variante_id, sucursal_id, stock_actual, stock_minimo)
    values (p_articulo_id, p_variante_id, p_sucursal_id, 0, 0);
    v_stock := 0;
  end if;

  return v_stock;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: descontar stock de los ítems de una OT
-- ─────────────────────────────────────────────────────────────────────────────
-- Idempotente: si stock_descontado_at ya está seteado no hace nada.
-- Devuelve { ok, error?, numero, articulo_ids }. El route decide el status HTTP.
create or replace function public.descontar_stock_optica_orden(
  p_orden_id   bigint,
  p_usuario_id uuid
) returns json
language plpgsql
as $$
declare
  v_id         bigint;
  v_numero     text;
  v_sucursal   bigint;
  v_descontado timestamptz;
  v_items      json;
  v_item       jsonb;
  v_controlled boolean;
  v_stock      numeric;
  v_cantidad   numeric;
  v_ids        bigint[] := '{}';
  v_faltantes  text := '';
begin
  -- for update: evita doble descuento si dos requests llegan a la vez
  select id, numero, sucursal_id, stock_descontado_at
    into v_id, v_numero, v_sucursal, v_descontado
  from public.optica_ordenes
  where id = p_orden_id
  for update;

  if v_id is null then
    return json_build_object('ok', false, 'error', format('OT %s no encontrada', p_orden_id));
  end if;

  if v_descontado is not null then
    return json_build_object('ok', true, 'ya_descontado', true, 'numero', v_numero, 'articulo_ids', to_jsonb(v_ids));
  end if;

  if v_sucursal is null then
    return json_build_object('ok', false, 'error', format('La OT %s no tiene sucursal registrada', v_numero));
  end if;

  -- Solo ítems con artículo del catálogo.
  -- armazon_propio manda sobre articulo_id: la UI permite marcar un armazón
  -- como propio del cliente sin limpiar el artículo elegido, y en ese caso
  -- el cliente lo aporta, no el stock. Los servicios (cristal, tratamiento,
  -- otro) nunca llevan articulo_id.
  select coalesce(json_agg(json_build_object(
           'articulo_id', i.articulo_id,
           'variante_id', i.variante_id,
           'cantidad',    i.cantidad
         )), '[]'::json)
    into v_items
  from public.optica_orden_items i
  where i.orden_id = p_orden_id
    and i.articulo_id is not null
    and i.armazon_propio is not true
    and i.cantidad > 0;

  if jsonb_array_length(v_items::jsonb) = 0 then
    update public.optica_ordenes
       set stock_descontado_at = now(), updated_at = now()
     where id = p_orden_id;
    return json_build_object('ok', true, 'numero', v_numero, 'articulo_ids', to_jsonb(v_ids));
  end if;

  -- Validación previa. Respeta parametros.controla_stock igual que
  -- validarStockSuficiente() en services/stock.ts
  select (valor = 'true') into v_controlled
  from public.parametros where clave = 'controla_stock';
  v_controlled := coalesce(v_controlled, false);

  if v_controlled then
    for v_item in select * from jsonb_array_elements(v_items::jsonb) loop
      v_cantidad := (v_item->>'cantidad')::numeric;

      select coalesce((
        select stock_actual from public.articulo_stock
        where articulo_id = (v_item->>'articulo_id')::bigint
          and sucursal_id = v_sucursal
          and variante_id is not distinct from nullif(v_item->>'variante_id', '')::bigint
      ), 0) into v_stock;

      if v_stock < v_cantidad then
        v_faltantes := v_faltantes || case when v_faltantes = '' then '' else ', ' end
          || format('artículo %s%s (disponible: %s, requerido: %s)',
               v_item->>'articulo_id',
               case when nullif(v_item->>'variante_id','') is not null
                    then ' var.' || (v_item->>'variante_id') else '' end,
               v_stock, v_cantidad);
      end if;
    end loop;

    if v_faltantes <> '' then
      return json_build_object('ok', false, 'error', 'Stock insuficiente: ' || v_faltantes, 'numero', v_numero);
    end if;
  end if;

  -- Descontar
  for v_item in select * from jsonb_array_elements(v_items::jsonb) loop
    v_stock := public.stock_actual_o_crear(
      (v_item->>'articulo_id')::bigint,
      nullif(v_item->>'variante_id','')::bigint,
      v_sucursal
    );
    v_cantidad := (v_item->>'cantidad')::numeric;

    update public.articulo_stock
       set stock_actual = stock_actual - v_cantidad,
           updated_at  = now()
     where articulo_id = (v_item->>'articulo_id')::bigint
       and sucursal_id = v_sucursal
       and variante_id is not distinct from nullif(v_item->>'variante_id','')::bigint;

    insert into public.movimientos_stock
      (articulo_id, variante_id, sucursal_id, tipo, cantidad,
       stock_antes, stock_despues, referencia, observaciones, usuario_id)
    values
      ((v_item->>'articulo_id')::bigint,
       nullif(v_item->>'variante_id','')::bigint,
       v_sucursal,
       'optica',
       v_cantidad,
       v_stock,
       v_stock - v_cantidad,
       v_numero,
       'Orden de trabajo de óptica',
       p_usuario_id);

    v_ids := v_ids || (v_item->>'articulo_id')::bigint;
  end loop;

  update public.optica_ordenes
     set stock_descontado_at = now(), updated_at = now()
   where id = p_orden_id;

  return json_build_object('ok', true, 'numero', v_numero, 'articulo_ids', to_jsonb(v_ids));
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: revertir el stock de una OT
-- ─────────────────────────────────────────────────────────────────────────────
-- Idempotente: si stock_descontado_at es NULL no hace nada.
-- Se apoya en optica_orden_items (que el PUT mantiene sincronizado con el
-- descuento vigente) y no en los movimientos, porque una OT puede tener varias
-- generaciones de movimientos 'optica' si fue editada.
create or replace function public.revertir_stock_optica_orden(
  p_orden_id   bigint,
  p_usuario_id uuid
) returns json
language plpgsql
as $$
declare
  v_id         bigint;
  v_numero     text;
  v_sucursal   bigint;
  v_descontado timestamptz;
  v_items      json;
  v_item       jsonb;
  v_stock      numeric;
  v_cantidad   numeric;
  v_ids        bigint[] := '{}';
begin
  select id, numero, sucursal_id, stock_descontado_at
    into v_id, v_numero, v_sucursal, v_descontado
  from public.optica_ordenes
  where id = p_orden_id
  for update;

  if v_id is null then
    return json_build_object('ok', false, 'error', format('OT %s no encontrada', p_orden_id));
  end if;

  if v_descontado is null then
    return json_build_object('ok', true, 'ya_revertido', true, 'numero', v_numero, 'articulo_ids', to_jsonb(v_ids));
  end if;

  if v_sucursal is null then
    return json_build_object('ok', false, 'error', format('La OT %s no tiene sucursal registrada', v_numero));
  end if;

  -- Mismo criterio que descontar_stock_optica_orden: armazon_propio excluye.
  select coalesce(json_agg(json_build_object(
           'articulo_id', i.articulo_id,
           'variante_id', i.variante_id,
           'cantidad',    i.cantidad
         )), '[]'::json)
    into v_items
  from public.optica_orden_items i
  where i.orden_id = p_orden_id
    and i.articulo_id is not null
    and i.armazon_propio is not true
    and i.cantidad > 0;

  for v_item in select * from jsonb_array_elements(v_items::jsonb) loop
    v_stock := public.stock_actual_o_crear(
      (v_item->>'articulo_id')::bigint,
      nullif(v_item->>'variante_id','')::bigint,
      v_sucursal
    );
    v_cantidad := (v_item->>'cantidad')::numeric;

    update public.articulo_stock
       set stock_actual = stock_actual + v_cantidad,
           updated_at  = now()
     where articulo_id = (v_item->>'articulo_id')::bigint
       and sucursal_id = v_sucursal
       and variante_id is not distinct from nullif(v_item->>'variante_id','')::bigint;

    insert into public.movimientos_stock
      (articulo_id, variante_id, sucursal_id, tipo, cantidad,
       stock_antes, stock_despues, referencia, observaciones, usuario_id)
    values
      ((v_item->>'articulo_id')::bigint,
       nullif(v_item->>'variante_id','')::bigint,
       v_sucursal,
       'anulacion_ot',
       v_cantidad,
       v_stock,
       v_stock + v_cantidad,
       v_numero,
       'Anulación OT de óptica',
       p_usuario_id);

    v_ids := v_ids || (v_item->>'articulo_id')::bigint;
  end loop;

  update public.optica_ordenes
     set stock_descontado_at = null, updated_at = now()
   where id = p_orden_id;

  return json_build_object('ok', true, 'numero', v_numero, 'articulo_ids', to_jsonb(v_ids));
end
$$;

grant execute on function public.descontar_stock_optica_orden(bigint, uuid) to authenticated, service_role;
grant execute on function public.revertir_stock_optica_orden(bigint, uuid) to authenticated, service_role;
