# ordenes.md — Órdenes de Venta

Adjuntá este archivo para trabajar en el módulo de órdenes de venta.

---

## Archivos del módulo

| Archivo | Descripción |
|---------|-------------|
| `app/(dashboard)/dashboard/ordenes/page.tsx` | Lista de órdenes |
| `app/(dashboard)/dashboard/ordenes/nueva/page.tsx` | Crear orden |
| `app/(dashboard)/dashboard/ordenes/[id]/page.tsx` | Detalle / editar |
| `app/api/dashboard/ordenes/route.ts` | GET (lista) + POST (crear) |
| `app/api/dashboard/ordenes/[id]/route.ts` | GET + PUT (editar) + DELETE |
| `app/api/dashboard/ordenes/[id]/confirmar/route.ts` | POST (confirmar) |
| `app/api/dashboard/ordenes/[id]/anular/route.ts` | POST (anular) |
| `types/ordenes.ts` | Tipos TypeScript |

---

## Estados de una orden

```
borrador ──► confirmada ──► anulada
   └──────────────────────► anulada
```

- **borrador:** Editable. Sin efecto en stock ni caja.
- **confirmada:** Stock descontado, pagos procesados. No editable.
- **anulada:** Revertido todo lo que se procesó al confirmar.

---

## Creación de orden (POST)

Al crear en borrador:
1. Obtiene `sucursal_id` de la cookie activa → se guarda en `ordenes_venta.sucursal_id`
2. Inserta `ordenes_venta` con estado='borrador'
3. Inserta `orden_venta_items`
4. Inserta `orden_venta_pagos`
5. **No** toca stock ni caja

---

## Confirmación (POST /[id]/confirmar)

Requiere `estado === 'borrador'` y al menos un ítem.

**Lo que hace:**
1. Valida notas de crédito (saldo suficiente, no anuladas)
2. Determina `sucursal_id`: usa la guardada en la orden; fallback a cookie activa (para órdenes históricas)
3. `adjustArticuloStock(-cantidad)` por cada ítem → descuenta stock
4. `syncArticuloStock()` por artículo único
5. Descuenta `notas_credito.monto_disponible` para pagos NOTA_CREDITO
6. Si hay pago CUENTA_CORRIENTE y hay cliente → inserta en `cobranzas` (tipo='CARGO')
7. Para resto de métodos → inserta en `caja_movimientos` (ingreso). Si no hay caja abierta, crea una automáticamente.
8. Actualiza `ordenes_venta.estado = 'confirmada'`

---

## Anulación (POST /[id]/anular)

Puede anularse en cualquier estado excepto 'anulada'.
Si estaba en 'borrador', solo cambia el estado.
Si estaba en 'confirmada', revierte todo:

**Lo que hace:**
1. Restaura saldo de notas de crédito usadas
2. Revierte stock: `adjustArticuloStock(+cantidad)` en la misma `sucursal_id`
3. `syncArticuloStock()` por artículo
4. Si había pago CUENTA_CORRIENTE → inserta en `cobranzas` (tipo='PAGO') para revertir cargo
5. Para resto de métodos → inserta en `caja_movimientos` (egreso). Crea caja si no hay abierta.
6. Actualiza `ordenes_venta.estado = 'anulada'`

---

## Métodos de pago (`METODO_ORDEN_LABELS`)

```typescript
'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO'
| 'CUENTA_CORRIENTE' | 'NOTA_CREDITO' | 'CHEQUE' | 'OTRO'
```

Importado desde `types/ordenes.ts` como `METODO_ORDEN_LABELS`.

---

## Tipos clave (`types/ordenes.ts`)

```typescript
type EstadoOrden = 'borrador' | 'confirmada' | 'anulada'
type CondicionPago = 'contado' | 'cuenta_corriente' | 'otro'

type OrdenVenta = {
  id: number
  numero: string
  fecha: string
  vencimiento: string | null
  cliente_id: number | null
  vendedor_id: string
  condicion_pago: CondicionPago
  subtotal: number
  descuento_pct: number
  descuento_monto: number
  total: number
  estado: EstadoOrden
  sucursal_id: number | null
  observaciones: string | null
  created_by: string
}

type OrdenVentaItem = {
  id: number
  orden_id: number
  articulo_id: number
  variante_id: number | null
  nombre_articulo: string
  descripcion_variante: string | null
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  subtotal: number
}

type OrdenVentaPago = {
  id: number
  orden_id: number
  metodo: string
  monto: number
  referencia: string | null
  nota_credito_id: number | null
  fecha_pago: string | null
}
```

---

## Reglas de negocio

- Para CUENTA_CORRIENTE debe haber `cliente_id`.
- Para NOTA_CREDITO debe haber `nota_credito_id` (nunca enviar el campo si es null — error en schema cache).
- La `sucursal_id` se guarda al crear la orden y se usa al confirmar. Fallback a sucursal activa solo para órdenes históricas sin `sucursal_id`.
- Al confirmar, si no hay caja abierta se crea una automáticamente con `monto_apertura = 0`.

### FormasPagoCobro (componente unificado de pagos)

El formulario de OV usa el componente `FormasPagoCobro` (`components/pago/FormasPagoCobro.tsx`) para el selector de métodos de pago. Este componente calcula recargo sobre el **saldo** (no sobre el total):

```
saldo = max(0, total - totalPagado)
recargo = round(saldo * pct / 100 * 100) / 100
```

- Se muestra un banner amber cuando `saldo < total` (indicando que ya hay pagos previos)
- El recargo y la cuota se recalculan dinámicamente al cambiar los pagos

---

*Última actualización: 2026-07-14*
