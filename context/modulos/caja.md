# caja.md — Caja

Adjuntá este archivo para trabajar en el módulo de caja.

---

## Archivos del módulo

| Archivo | Descripción |
|---------|-------------|
| `app/(dashboard)/dashboard/caja/page.tsx` | Panel de caja (apertura, movimientos, cierre) |
| `app/api/dashboard/caja/sesion/route.ts` | GET (sesión activa) + POST (abrir) |
| `app/api/dashboard/caja/sesion/[id]/movimientos/route.ts` | GET + POST movimientos |
| `app/api/dashboard/caja/sesion/[id]/cerrar/route.ts` | POST cerrar sesión |
| `types/ventas.ts` | Tipos `CajaSesion`, `CajaMovimiento` |

---

## Ciclo de vida de una sesión

```
Apertura                 Movimientos                 Cierre
  │                          │                          │
POST /sesion          POST /movimientos          POST /cerrar
monto_apertura        ingreso / egreso           monto_cierre
estado='abierta'      (manual o automático)      monto_esperado
                                                 diferencia
                                                 estado='cerrada'
```

---

## Restricciones importantes

- **Solo puede haber una sesión abierta a la vez** (unique partial index en estado='abierta').
- Si intentás abrir una segunda sesión → error de constraint.
- Cerrar la sesión no impide crear movimientos o ventas retroactivos, pero normalmente primero se cierran todos los movimientos del día.

---

## Movimientos automáticos

La caja registra movimientos automáticamente al:

| Operación | Tipo movimiento | Concepto generado |
|-----------|----------------|-------------------|
| Venta POS | ingreso | "Venta {numero} - {MetodoPago}" |
| Anulación de venta | egreso | "Anulación venta {numero} - {MetodoPago}" |
| Confirmar orden | ingreso | "Orden {numero} - {MetodoPago}" |
| Anular orden confirmada | egreso | "Anulación orden {numero} - {MetodoPago}" |

Solo se registran los pagos que **no son CUENTA_CORRIENTE** (esos van a cobranzas, no a caja).

---

## Caja en órdenes de venta

Al confirmar una orden, si no hay caja abierta, se **crea automáticamente** una sesión con `monto_apertura = 0`. Esto permite que las órdenes funcionen sin abrir caja manualmente.

---

## Monto esperado al cierre

La función SQL `caja_monto_esperado(sesion_id)` calcula:
```
monto_apertura
+ suma ventas EFECTIVO completadas en la sesión
+ suma caja_movimientos ingreso
- suma caja_movimientos egreso
```

Al cerrar, el sistema muestra la diferencia entre lo físico (`monto_cierre`) y lo calculado (`monto_esperado`).

---

## Tipos clave (`types/ventas.ts`)

```typescript
type EstadoCaja = 'abierta' | 'cerrada'
type TipoMovCaja = 'ingreso' | 'egreso'

type CajaSesion = {
  id: number
  usuario_id: string
  fecha_apertura: string
  monto_apertura: number
  fecha_cierre: string | null
  monto_cierre: number | null
  monto_esperado: number | null
  diferencia: number | null
  observaciones: string | null
  estado: EstadoCaja
}

type CajaMovimiento = {
  id: number
  sesion_id: number
  tipo: TipoMovCaja
  concepto: string
  monto: number
  usuario_id: string
  created_at: string
}
```

---

*Última actualización: 2026-05-28*
