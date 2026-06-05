# ventas.md — POS y Ventas

Adjuntá este archivo para trabajar en el módulo de ventas o punto de venta.

---

## Archivos del módulo

| Archivo | Descripción |
|---------|-------------|
| `app/(dashboard)/dashboard/ventas/page.tsx` | Historial de ventas |
| `app/(dashboard)/dashboard/ventas/pos/page.tsx` | Interfaz POS |
| `app/(dashboard)/dashboard/ventas/[id]/page.tsx` | Detalle de venta |
| `app/(dashboard)/dashboard/ventas/ordenes/page.tsx` | Server wrapper de lista de órdenes (pasa `isAdmin`) |
| `app/(dashboard)/dashboard/ventas/ordenes/_client.tsx` | Lista de órdenes de venta (client component) |
| `app/(dashboard)/dashboard/ventas/ordenes/[id]/page.tsx` | Detalle/edición de orden de venta |
| `app/api/dashboard/ventas/route.ts` | GET (lista) + POST (crear venta) |
| `app/api/dashboard/ventas/[id]/route.ts` | GET (detalle) + DELETE (solo admin, solo anuladas) |
| `app/api/dashboard/ventas/[id]/anular/route.ts` | POST (anular venta) |
| `app/api/dashboard/ordenes/route.ts` | GET (lista) + POST (crear orden) |
| `app/api/dashboard/ordenes/[id]/route.ts` | GET + PUT + DELETE (solo admin, solo borradores) |
| `types/ventas.ts` | Tipos TypeScript |

---

## Selector de lista de precios (POS y Órdenes de venta)

Ambos módulos muestran un selector de lista de precios encima del buscador de artículos.

- Carga las listas con `categoria = 'venta'` y `activo = true` desde `/api/dashboard/listas-precio`
- Por defecto selecciona la que tenga "público/publica" en el nombre; si no existe, la primera
- Al agregar un artículo, `addToCart`/`addItem` es **async**: consulta `/api/dashboard/articulos/{id}/precios?variante_id={v}` y aplica `precio_calculado ?? precio` del registro que coincida con `lista_precio_id`
- Si el artículo no tiene precio en esa lista, usa `precio_venta` como fallback

```typescript
// Estado en POS y en ordenes/[id]
const [listas, setListas]   = useState<{ id: number; nombre: string }[]>([])
const [listaId, setListaId] = useState<number | null>(null)
```

---

## Flujo de creación de venta (POS)

```
1. Usuario selecciona lista de precios (default: Venta Público)
2. Busca artículos (buscar_articulos RPC — fuzzy search)
3. Agrega ítems al carrito — precio tomado de la lista seleccionada
4. Selecciona (opcional) cliente
5. Aplica descuento global (% o monto)
6. Ingresa métodos de pago hasta cubrir el total
7. POST /api/dashboard/ventas → crea la venta
```

**Lo que hace el POST al crear una venta:**
1. Obtiene `sucursal_id` de la cookie activa → 400 si no hay
2. Verifica caja abierta → 400 si no hay
3. Inserta fila en `ventas` con `sucursal_id`
4. Inserta `venta_items` (snapshot de nombres y precios)
5. Llama `adjustArticuloStock()` por cada ítem → descuenta de `articulo_stock`
6. Si error de stock → elimina la venta y retorna 500
7. Llama `syncArticuloStock()` por cada artículo único
8. Inserta `venta_pagos`
9. Si hay pago con CUENTA_CORRIENTE → inserta en `cobranzas` (tipo='CARGO')
10. Si hay pago con NOTA_CREDITO → descuenta `notas_credito.monto_disponible`
11. Inserta movimientos en `caja_movimientos` (excepto CUENTA_CORRIENTE)
12. Inserta en `movimientos_stock` (auditoría)

---

## Devolución en POS

Se hace creando una venta con cantidad negativa en los ítems.
`adjustArticuloStock()` con `delta = -(-n) = +n` → devuelve stock automáticamente.

---

## Anulación de venta

`POST /api/dashboard/ventas/[id]/anular`

Requiere `venta.estado === 'completada'` y `venta.sucursal_id` no null (ventas históricas sin sucursal no se pueden anular).

**Lo que hace la anulación:**
1. Revierte stock: `adjustArticuloStock(+cantidad)` por cada ítem en la misma `sucursal_id`
2. `syncArticuloStock()` por artículo
3. Restaura saldo de notas de crédito usadas
4. Si había pago CUENTA_CORRIENTE → inserta en `cobranzas` (tipo='PAGO') para revertir
5. Crea movimientos de egreso en `caja_movimientos` por métodos no-CC
6. Actualiza `ventas.estado = 'anulada'`

---

## Métodos de pago (`MetodoPago`)

```typescript
'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO'
| 'CUENTA_CORRIENTE' | 'NOTA_CREDITO' | 'OTRO'
```

- `CUENTA_CORRIENTE`: requiere cliente seleccionado → genera cargo en cobranzas
- `NOTA_CREDITO`: requiere `nota_credito_id` → descuenta `monto_disponible`
- Resto: generan movimiento en `caja_movimientos`

---

## Tipos clave (`types/ventas.ts`)

```typescript
type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO'
                | 'CUENTA_CORRIENTE' | 'NOTA_CREDITO' | 'OTRO'

type EstadoVenta = 'completada' | 'anulada'

type Venta = {
  id: number
  numero: string
  fecha: string
  cliente_id: number | null
  vendedor_id: string
  caja_sesion_id: number
  subtotal: number
  descuento_pct: number
  descuento_monto: number
  total: number
  sucursal_id: number | null
  estado: EstadoVenta
  observaciones: string | null
}

type VentaItem = {
  id: number
  venta_id: number
  articulo_id: number
  variante_id: number | null
  nombre_articulo: string
  descripcion_variante: string | null
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  subtotal: number
}

type VentaPago = {
  id: number
  venta_id: number
  metodo: MetodoPago
  monto: number
  referencia: string | null
  nota_credito_id: number | null
}
```

---

## Reglas de negocio importantes

- Una venta siempre se vincula a una caja abierta (`caja_sesion_id`). Si no hay caja abierta → error 400.
- `sucursal_id` en la venta determina de qué sucursal se descuenta el stock.
- Para usar NOTA_CREDITO se debe pasar `nota_credito_id` en el pago (no enviar el campo si es null — causa error en schema cache de PostgREST).
- Para usar CUENTA_CORRIENTE debe haber un `cliente_id`.
- Una venta ya anulada no puede volver a anularse.

---

## Eliminación de ventas y órdenes (solo Administrador)

### Ventas (`DELETE /api/dashboard/ventas/[id]`)
- Solo `session.user.role === 'Administrador'` (403 si no)
- Solo si `estado === 'anulada'` (409 si no)
- Inserta snapshot en `eliminaciones_log` (tipo = `'venta'`)
- Botón Trash2 visible en la lista solo para admins en ventas anuladas

### Órdenes de venta (`DELETE /api/dashboard/ordenes/[id]`)
- Solo Administrador (403 si no)
- Solo si `estado === 'borrador'` (409 si no — borradores son los únicos sin impacto financiero)
- Inserta snapshot en `eliminaciones_log` (tipo = `'orden_venta'`)
- Botón Trash2 visible en la lista solo para admins en órdenes en borrador

### Patrón frontend (server wrapper)
Las páginas de lista (`ventas/ordenes/page.tsx`) son server components que llaman `auth()` y pasan `isAdmin` al `_client.tsx`.

---

*Última actualización: 2026-06-03*
