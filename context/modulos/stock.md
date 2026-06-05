# stock.md — Stock, Remitos y Ajustes

Adjuntá este archivo para trabajar en stock, remitos de entrada/salida o ajustes.

---

## Archivos del módulo

| Archivo | Descripción |
|---------|-------------|
| `services/stock.ts` | `adjustArticuloStock()` + `syncArticuloStock()` |
| `app/(dashboard)/dashboard/inventario/remitos/page.tsx` | Server wrapper lista de remitos (pasa `isAdmin`) |
| `app/(dashboard)/dashboard/inventario/remitos/_client.tsx` | Lista de remitos (client component) |
| `app/(dashboard)/dashboard/inventario/remitos/nuevo/page.tsx` | Crear remito |
| `app/(dashboard)/dashboard/inventario/remitos/[id]/page.tsx` | Detalle remito |
| `app/(dashboard)/dashboard/inventario/remitos/[id]/editar/page.tsx` | Editar ítems de un remito (borrador o confirmado) |
| `app/(dashboard)/dashboard/inventario/remitos/ajustes/page.tsx` | Ajustes manuales de stock |
| `app/api/dashboard/stock/remitos/route.ts` | GET + POST remitos |
| `app/api/dashboard/stock/remitos/[id]/route.ts` | GET + PUT (borrador y confirmado) + DELETE (solo admin) |
| `app/api/dashboard/stock/remitos/[id]/confirmar/route.ts` | POST confirmar |
| `app/api/dashboard/stock/remitos/[id]/anular/route.ts` | POST anular |
| `app/api/dashboard/stock/ajustes/route.ts` | GET (discrepancias) + POST (aplicar ajustes) |
| `types/stock.ts` | Tipos TypeScript |

---

## Arquitectura de stock

```
articulo_stock                     ← FUENTE DE VERDAD
  (articulo_id, variante_id, sucursal_id, stock_actual)
         │
         │  syncArticuloStock()
         ▼
articulo_variantes.stock_actual    ← total calculado por variante
articulos.stock_actual             ← total global calculado
```

**Regla:** Nunca escribir directamente en `articulos.stock_actual` ni en `articulo_variantes.stock_actual`.
Siempre usar `adjustArticuloStock()` y luego `syncArticuloStock()`.

---

## Funciones en `services/stock.ts`

### `adjustArticuloStock(articulo_id, variante_id, sucursal_id, delta)`

```typescript
async function adjustArticuloStock(
  articulo_id: number,
  variante_id: number | null,
  sucursal_id: number,
  delta: number,  // positivo = entrada, negativo = salida
): Promise<string | null>  // null = éxito, string = mensaje de error
```

- Normaliza `variante_id ?? null` (maneja `undefined` también)
- Si existe fila en `articulo_stock`: UPDATE con `stock_actual + delta`
- Si no existe: INSERT con `stock_actual = delta`
- Usa composite key con `.is('variante_id', null)` para artículos sin variante
- No llama `syncArticuloStock` — el caller lo hace una vez por artículo al terminar el loop

### `syncArticuloStock(articulo_id)`

- Lee todas las filas de `articulo_stock` para ese `articulo_id`
- Para cada `variante_id` distinto: suma stock de todas las sucursales → UPDATE `articulo_variantes.stock_actual`
- Suma todo → UPDATE `articulos.stock_actual`

### Patrón de uso en route handlers

```typescript
const articuloIds = new Set<number>()
for (const item of items) {
  const err = await adjustArticuloStock(item.articulo_id, item.variante_id ?? null, sucursalId, delta)
  if (err) return NextResponse.json({ error: `Error ajustando stock: ${err}` }, { status: 500 })
  articuloIds.add(item.articulo_id)
}
for (const aid of articuloIds) await syncArticuloStock(aid)
```

---

## Tabla `articulo_stock` — notas importantes

La tabla fue creada con PK compuesta `(articulo_id, sucursal_id)` en lugar del `id bigserial` del schema.sql.

Para soportar múltiples variantes del mismo artículo por sucursal se debe migrar:
```sql
ALTER TABLE public.articulo_stock DROP CONSTRAINT articulo_stock_pkey;
ALTER TABLE public.articulo_stock ADD COLUMN id bigserial;
ALTER TABLE public.articulo_stock ADD CONSTRAINT articulo_stock_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX articulo_stock_simple_idx ON public.articulo_stock (articulo_id, sucursal_id) WHERE variante_id IS NULL;
CREATE UNIQUE INDEX articulo_stock_variante_idx ON public.articulo_stock (articulo_id, variante_id, sucursal_id) WHERE variante_id IS NOT NULL;
```

El código **no usa columna `id`** ni `updated_at` — usa composite key matching en todos los SELECTs/UPDATEs/INSERTs.

**Crítico:** Siempre usar `.is('variante_id', null)` para artículos sin variante (no `.eq('variante_id', null)`).
Si no, el SELECT no encuentra la fila y el INSERT falla con "duplicate key value violates unique constraint articulo_stock_pkey".

---

## Remitos

### Estados
```
borrador ──► confirmado ──► anulado
```

### Tipos
- **entrada:** Ingreso de stock a la sucursal (`delta = +1`)
- **salida:** Egreso de stock de la sucursal (`delta = -1`)

### Confirmación (POST /confirmar)
1. Requiere `estado === 'borrador'` y al menos un ítem
2. `adjustArticuloStock(delta * cantidad)` por cada ítem en `remito.sucursal_id`
3. `syncArticuloStock()` por artículo único
4. Actualiza `estado = 'confirmado'`
5. Si `tipo === 'salida'` y `contraparte_tipo === 'sucursal'`: crea remito entrada en la sucursal destino, ajusta su stock y lo confirma automáticamente (vinculado por `remito_origen_id`)

### Anulación (POST /anular)
1. Requiere `estado === 'confirmado'`
2. `adjustArticuloStock(delta_opuesto * cantidad)` en la misma sucursal
3. `syncArticuloStock()` por artículo
4. Actualiza `estado = 'anulado'`
5. Si era salida→sucursal: busca el remito entrada vinculado (`remito_origen_id = id`), revierte su stock en la sucursal destino y lo anula también

### Edición (PUT /[id])
- Funciona para `borrador` y `confirmado` (no para `anulado`)
- Para **borrador**: reemplaza ítems sin tocar el stock (no se ha movido aún)
- Para **confirmado**: calcula el delta (cantidad nueva − cantidad vieja) por cada ítem y llama `adjustArticuloStock`; los ítems eliminados se tratan como cantidad = 0; los ítems nuevos aplican el delta completo
- Si es salida→sucursal confirmado: aplica los mismos deltas en la sucursal destino y reemplaza los ítems del remito entrada vinculado

### Contraparte
- `'persona'`: nombre libre
- `'proveedor'`: `contraparte_proveedor_id` → proveedores
- `'sucursal'`: `contraparte_sucursal_id` → sucursales

---

## Ajustes de stock

`GET /api/dashboard/stock/ajustes` calcula discrepancias comparando:
- Stock real en `articulo_stock`
- Stock esperado desde remitos + ventas + órdenes confirmadas

`POST /api/dashboard/stock/ajustes` aplica ajustes:
- Composite key matching → UPDATE o INSERT en `articulo_stock`
- `syncArticuloStock()` al final por artículo

---

## Multi-sucursal

- Cada fila de `articulo_stock` pertenece a una sucursal
- Sucursal activa: cookie leída con `getActiveSucursalId()` en `lib/sucursal.ts`
- Ventas y órdenes guardan `sucursal_id` al crear → se usa para revertir al anular
- Remitos tienen `sucursal_id` explícito en el documento

---

## Tipos clave (`types/stock.ts`)

```typescript
type TipoRemito = 'entrada' | 'salida'
type EstadoRemito = 'borrador' | 'confirmado' | 'anulado'
type ContraparteTipo = 'persona' | 'proveedor' | 'sucursal'

type Remito = {
  id: number
  numero: string
  tipo: TipoRemito
  sucursal_id: number
  contraparte_tipo: ContraparteTipo
  contraparte_nombre: string | null
  contraparte_sucursal_id: number | null
  contraparte_proveedor_id: number | null
  fecha: string
  estado: EstadoRemito
  observaciones: string | null
  created_by: string
}
```

---

---

## Eliminación de remitos (solo Administrador)

`DELETE /api/dashboard/stock/remitos/[id]`

- Solo `session.user.role === 'Administrador'` (403 si no)
- Solo si `estado` es `'borrador'` o `'anulado'` — los confirmados movieron stock (409 si no cumple)
- Inserta snapshot en `eliminaciones_log` (tipo = `'remito'`, `datos_extra.tipo_remito`)
- Botón Trash2 visible en la lista solo para admins en remitos borrador o anulados

---

*Última actualización: 2026-06-04*
