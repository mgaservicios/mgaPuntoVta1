# Flujo de stock de un artículo

Referencia rápida de qué tablas se tocan, cuándo entra stock, cuándo egresa y qué queda
registrado en el historial. Para consultar el historial en pantalla: **Consultas → Seguimiento**
(`/dashboard/consultas/seguimiento`).

---

## Las 3 tablas que se tocan

| Tabla | Qué es | Quién la escribe |
|---|---|---|
| **`articulo_stock`** | **La verdad.** Stock real por sucursal | Todos los flujos, vía `adjustArticuloStock()` |
| `articulos.stock_actual`<br>`articulo_variantes.stock_actual` | Suma de **todas** las sucursales. Solo para mostrar en grillas | `syncArticuloStock()`, al final de cada flujo |
| **`movimientos_stock`** | **Auditoría.** Una fila por movimiento, con `stock_antes` / `stock_despues` | Solo algunos flujos (ver tablas) |

**Clave de `articulo_stock`:** una fila por `(articulo_id, variante_id, sucursal_id)`.
Si `variante_id` es `NULL` → stock a nivel artículo. Si tiene valor → stock de esa variante.

> Las dos primeras van siempre juntas. `articulo_stock` es el dato real; los otros dos son derivados.
> Si alguna vez no cuadran, se recalcula con `syncArticuloStock()`.

---

## Cuando **ingresa** stock (+)

| Origen | `articulo_stock` | `movimientos_stock` | `remito_items` |
|---|---|---|---|
| Importar stock (masivo) | + | `entrada` | sí |
| Importar stock óptico | + | `entrada` | sí |
| Remito de proveedor | + | **no** | sí |
| Remito inter-sucursal **destino** | + | `entrada` | sí |
| Ajuste manual por diferencias | + | **no** | sí (`AJUSTE DE STOCK`) |
| Stock inicial (carga rápida) | + | **no** | sí |
| Anulación de venta | + | `anulacion_venta` | — |
| Anulación de orden de venta | + | `devolucion` | — |
| Anulación de remito | + | **no** | — |
| Anulación de OT de óptica | + | `anulacion_ot` | — |

## Cuando **egresa** stock (−)

| Origen | `articulo_stock` | `movimientos_stock` | Referencia |
|---|---|---|---|
| Venta de POS | − | `venta` | `venta_id` |
| Orden de venta confirmada | − | `orden` | `numero` |
| Remito de salida | − | **no** | — |
| Remito inter-sucursal **origen** | − | **no** | — |
| Ajuste manual | − | **no** | — |
| **OT de óptica** | − | `optica` | `OT-XX-XXXXX` |
| Venta con devolución (línea negativa) | + | `devolucion` | `venta_id` |

**Convención:** en `movimientos_stock`, `cantidad` **siempre es positiva**. El signo lo define el `tipo`:

- Salen stock → `venta`, `orden`, `optica`, `salida`
- Vuelve stock → `entrada`, `devolucion`, `anulacion_venta`, `anulacion_ot`

En Consultas → Seguimiento, el color y el `+`/`−` se sacan de una lista:
`app/(dashboard)/dashboard/consultas/seguimiento/page.tsx:41`.
**Si un `tipo` no está en esa lista, la fila sale neutra y con `+` aunque sea una salida.**
Por eso agregar un `tipo` nuevo obliga a tocar ese archivo.

---

## El ciclo de un documento

### Venta

```
crear    →  validateStock  →  articulo_stock −N  →  movimiento 'venta'  →  sync
anular   →  articulo_stock +N  →  movimiento 'anulacion_venta'  →  sync
eliminar →  DELETE movimientos (original + reversa)  →  DELETE venta
```

Eliminar solo se permite si ya está anulada, así que el stock ya volvió.

### Orden de venta

```
crear    →  queda en 'borrador', NO toca stock
confirmar→  validateStock  →  articulo_stock −N  →  movimiento 'orden'  →  sync
anular   →  articulo_stock +N  →  movimiento 'devolucion'  →  sync
eliminar →  solo si está en 'borrador' → nunca movió stock
```

### Remito

```
borrador →  NO toca stock
confirmar→  valida (solo salidas)  →  articulo_stock ±N  →  sync
            si es salida hacia otra sucursal, crea el remito de entrada
            en el destino y suma ahí
anular   →  articulo_stock ∓N  →  sync
            y anula el remito de entrada del destino, borrando sus movimientos
```

### OT de Óptica

```
crear    →  valida stock (RPC transaccional)  →  articulo_stock −N
                                              →  movimiento 'optica'  →  sync
                                              →  marca stock_descontado_at
          si no hay stock: 400 y la OT no se crea

editar  →  si ya descontó: revierte (sobre los ítems viejos)
           si no descontó (OT anterior a la migración): no revierte
         reemplaza los ítems
         →  descuenta los nuevos (RPC)  →  sync
         si el descuento falla: restaura los ítems anteriores y su descuento

anular  →  articulo_stock +N  →  movimiento 'anulacion_ot'  →  sync
         →  limpia stock_descontado_at
         (va antes del cambio de estado: si falla, la OT no queda anulada)

eliminar→  idem anular (revierte antes de borrar)
           solo admin, y solo si no tiene tareas ni pagos
```

**Solo descuentan los ítems con `articulo_id` y `armazon_propio = false`.** En la UI solo los
armazones llevan `articulo_id`; los cristales, tratamientos y "otro" no mueven stock. Ojo con
`armazon_propio`: la casilla "Propio del cliente" **no** limpia el `articulo_id` que ya estaba
elegido, así que un ítem puede tener ambos. El backend le da prioridad a `armazon_propio` (el
cliente aporta el armazón, no el stock) y la UI oculta el aviso de descuento en ese caso.

**La OT descuenta al crearse, no al terminarse.** Por eso editar una OT ya creada tiene que
reconciliar el stock: revertir lo anterior y aplicar lo nuevo. Por eso el PUT reconcilia **antes**
de tocar la cabecera de la OT: si algo falla, la OT queda exactamente como estaba.

El descuento y la reversión se hacen dentro de RPCs (`descontar_stock_optica_orden` /
`revertir_stock_optica_orden`) y no desde el route, para que sean atómicos e idempotentes: si
`stock_descontado_at` ya está puesto, descontar no hace nada; si está en `NULL`, revertir no hace
nada. `stock_descontado_at` es además el flag de idempotencia: si ya está puesto, descontar no hace nada, y
si está en `NULL`, revertir no hace nada.

---

## Dónde ver el historial

**Consultas → Seguimiento** (`/dashboard/consultas/seguimiento`)

Arma la línea de tiempo mezclando **dos fuentes**:

1. `movimientos_stock` — filtrado por sucursal activa
2. `remito_items` + `remitos` — solo remitos confirmados

Como la reconstrucción de stock deja un movimiento por cada remito confirmado, la fuente 2
sería un duplicado de la 1. Por eso `seguimiento/route.ts` deduplica: descarta el `remito_item`
cuando ya existe un movimiento con el mismo `remito_id` y `variante_id`. Así sigue apareciendo
el remito aunque su movimiento falte, sin mostrarlo dos veces cuando existe.

---

## Migración y regularización de datos

### Migraciones (aplicar en orden)

**1. `supabase/migrations/20260929_stock_consistencia.sql`**

- agrega `optica`, `anulacion_venta` y `anulacion_ot` al CHECK de `movimientos_stock.tipo`
- pone `ON DELETE CASCADE` en las FK `venta_id` y `venta_item_id` de `movimientos_stock`
- agrega `optica_ordenes.stock_descontado_at timestamptz`
- crea los RPCs `descontar_stock_optica_orden` y `revertir_stock_optica_orden`

**2. `supabase/migrations/20260930_stock_rebuild_refs.sql`**

- agrega `ventas.created_by uuid` (necesario para reconstruir el historial con su autor real)
- agrega `remito_id`, `orden_venta_id` y `optica_orden_id` a `movimientos_stock`, para que el
  vínculo con el documento de origen sea estructural y no dependa del texto de `referencia`

Ambas son idempotentes.

### Reconstrucción de stock

El stock **se recalcula desde los documentos**, no con parches incrementales. Los documentos son
la fuente de verdad: `remitos` confirmados (entradas y salidas), `venta_items`, `orden_venta_items`
y los armazones de catálogo de las OT.

| Script | Qué hace |
|---|---|
| `supabase/stock_rebuild_auditoria.sql` | **Solo lectura.** Calcula el stock resultante y muestra el impacto. Termina en `ROLLBACK` |
| `supabase/stock_rebuild.sql` | Aplica la reconstrucción y regenera `movimientos_stock` |
| `supabase/stock_rebuild_rollback.sql` | Deshace el rebuild desde las tablas de archivo |

Orden de ejecución: migraciones → auditoría → `stock_rebuild.sql`.

`stock_rebuild.sql` tiene un `dry_run` en la tabla temporal `_rb_config`. Con `true` aplica todo y
deshace todo al final: sirve para ver la verificación sin tocar nada. Con `false` aplica de verdad.

Criterios de inclusión, los mismos en el reporte y en el rebuild para que no puedan divergir:

- `remitos.estado = 'confirmado'` — un remito en borrador nunca movió stock
- `ventas.estado = 'completada'`
- `ordenes_venta.estado = 'confirmada'`
- `optica_ordenes.estado <> 'anulado'`, ítems con `articulo_id` y `armazon_propio` en `false`

El rebuild:

1. archiva el estado actual en `_archivo_movimientos_stock`, `_backup_articulo_stock` y
   `_backup_derivados_stock` (solo la primera corrida; después conserva el original)
2. borra `movimientos_stock` y lo regenera desde los documentos, encadenando `stock_antes` /
   `stock_despues` con una suma acumulada por `(articulo_id, variante_id, sucursal_id)`
3. reescribe `articulo_stock`: las claves sin documento quedan en 0, las que los documentos
   mencionan pero no tienen fila se crean. `stock_minimo` **no se toca**: no es derivable
4. recalcula `articulos.stock_actual` y `articulo_variantes.stock_actual`
5. aborta la transacción si la verificación no da todo en 0

Dos efectos que conviene conocer antes de correrlo:

- **El saldo deja de depender del orden en que se fueron tocando los flujos.** El `articulo_stock`
  actual arrastra el error acumulado de todos los flujos; el rebuild lo recalcula desde cero. La diferencia
  entre ambos es el reporte de deriva (sección 7 de la auditoría), y ahí puede haber hallazgos
  reales, no errores del script.- **Los negativos no se ocultan ni se corrigen.** Si un artículo se consumió más de lo que entró
  por documentos, queda en negativo. Con `controla_stock` activo la app va a bloquear la venta de
  esos artículos hasta regularizarlos con un remito de entrada.
- **Una venta anulada no deja movimientos.** El rebuild solo suma las ventas `completada`. Como una
  venta anulada sacó el stock y lo devolvió, el saldo neto es el mismo si no hay filas que las dos
  mostraran. Esto reemplaza al `backfill_ventas_anulacion.sql`, que insertaba la reversa a mano:
  ese script y su reporte quedaron sin uso después del rebuild.

### Sobre el origen de los datos de entrada

Todos los caminos que cargan stock crean un remito, así que `remitos` es fuente completa:

| Camino | Remito |
|---|---|
| `importar-stock` / `importar-optica/stock` | entrada, `confirmado` |
| `articulos/[id]/initial-stock` | entrada, `confirmado` |
| `stock/ajustes` | entrada o salida según el signo del delta, `confirmado` |
| `stock/remitos/[id]/confirmar` | entrada o salida, `confirmado` |


---

## Bugs corregidos

**1. Anular venta no dejaba rastro.** Devolvía el stock pero no insertaba el movimiento, así que en
Seguimiento la venta mostraba `−N` y nunca el `+N`, y los `stock_antes` siguientes quedaban
desfasados. Ahora inserta `anulacion_venta`.

**2. Eliminar venta estaba roto.** `movimientos_stock.venta_id` y `.venta_item_id` eran FK sin
`ON DELETE CASCADE`, y toda venta con stock tiene movimientos, así que el `DELETE` fallaba con 500
siempre. Ahora hay cascade y además el route borra los movimientos explícitamente antes de borrar
la venta (el efecto neto en stock es 0 porque la venta tiene que estar anulada).

**3. `con_stock` no filtraba en la búsqueda.** `articulos/route.ts` solo aplicaba el filtro en la
rama sin `q`, así que buscar armazones por texto devolvía artículos sin stock. Ahora aplica en
ambas.

**4. `/api/dashboard/articulos/[id]` no daba el stock de la sucursal activa.** `stock_actual` en
artículos y variantes es el agregado de todas las sucursales, así que la UI no podía mostrar el
stock real disponible. Ahora expone `stock_sucursal_actual` y `stock_sucursales`.

---

## Bugs conocidos (documentados, no arreglados)

**1. `controla_stock` está duplicado.** `parametros.controla_stock` es un flag global y
`sucursales.controla_stock` es por sucursal. `validarStockSuficiente()` y los RPCs usan el de
`parametros`, así que en una cadena con sucursales mixtas el control se aplica igual en todas.
Se dejó como está a propósito.

> Los otros dos que estaban acá (remito inter-sucursal duplicado en Seguimiento, y los flujos que
> movían stock sin dejar rastro) quedan resueltos por el rebuild: ahora todo movimiento de
> `movimientos_stock` tiene fila para cada documento, y el origen está enlazado por FK en vez de
> por el texto de `referencia`.

---

## Cómo verificar que todo cuadra

```sql
-- Stock real de un artículo en una sucursal
SELECT a.nombre, s.variante_id, s.sucursal_id, s.stock_actual
FROM articulo_stock s
JOIN articulos a ON a.id = s.articulo_id
WHERE s.articulo_id = <ID> AND s.sucursal_id = <ID_SUC>;

-- Últimos movimientos
SELECT tipo, cantidad, stock_antes, stock_despues, referencia, created_at
FROM movimientos_stock
WHERE articulo_id = <ID> AND sucursal_id = <ID_SUC>
ORDER BY created_at DESC LIMIT 20;

-- Movimientos de una OT
SELECT tipo, cantidad, referencia, created_at
FROM movimientos_stock
WHERE tipo IN ('optica','anulacion_ot') AND referencia = 'OT-01-00042';

-- Ventas anuladas a las que les falta la reversa (0 filas = todo ok)
SELECT m.venta_id, count(*) FILTER (WHERE m.tipo IN ('venta','devolucion')) AS salidas,
       count(*) FILTER (WHERE m.tipo = 'anulacion_venta') AS reversas
FROM movimientos_stock m
JOIN ventas v ON v.id = m.venta_id
WHERE v.estado = 'anulada' AND m.venta_id IS NOT NULL
GROUP BY m.venta_id
HAVING count(*) FILTER (WHERE m.tipo IN ('venta','devolucion')) <>
       count(*) FILTER (WHERE m.tipo = 'anulacion_venta');

-- OT descontadas sin su movimiento 'optica' (0 filas = todo ok)
SELECT o.id, o.numero FROM optica_ordenes o
WHERE o.stock_descontado_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM movimientos_stock m
                  WHERE m.tipo = 'optica' AND m.referencia = o.numero);
```

Si `articulo_stock` no coincide con el último `stock_despues` de `movimientos_stock`, se recalcula
llamando `syncArticuloStock(articulo_id, supabase)`.
