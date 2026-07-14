# caja.md — Caja

Adjuntá este archivo para trabajar en el módulo de caja.

---

## Archivos del módulo

| Archivo | Descripción |
|---------|-------------|
| `app/(dashboard)/dashboard/fondos/page.tsx` | Panel de caja (apertura, movimientos, cierre, banner sesión anterior) |
| `app/(dashboard)/dashboard/fondos/historial/page.tsx` | Historial de cajas (cerradas, abiertas, todas) con anulación |
| `app/api/dashboard/caja/sesion/route.ts` | GET (sesión activa + sesión anterior) + POST (abrir) |
| `app/api/dashboard/caja/sesion/[id]/movimientos/route.ts` | GET + POST movimientos |
| `app/api/dashboard/caja/sesion/[id]/cerrar/route.ts` | POST cerrar sesión |
| `app/api/dashboard/caja/sesion/[id]/continuar/route.ts` | POST continuar/cerrar y abrir nueva |
| `app/api/dashboard/caja/sesion/[id]/anular-movimiento/route.ts` | POST anular movimiento con auditoría |
| `app/api/dashboard/caja/historial/route.ts` | GET historial (filtrable por estado) |
| `app/api/dashboard/caja/movimientos-por-dia/route.ts` | GET movimientos del día (agrega 5 fuentes, filtra por sucursal) |
| `app/api/dashboard/listados/movimientos-caja/route.ts` | GET movimientos de caja por rango de fechas (listado completo) |
| `app/(dashboard)/dashboard/listados/movimientos-caja/page.tsx` | Página del listado de movimientos de caja |
| `app/(print)/dashboard/listados/movimientos-caja/print/page.tsx` | Página de impresión / PDF del listado |
| `types/ventas.ts` | Tipos `CajaSesion`, `CajaMovimiento`, `CajaMovimientoLog` |
| `supabase/migrations/20260711_caja_cierre_historial.sql` | Migración: fecha, sesion_anterior_id, log, permisos |
| `supabase/migrations/20260712_fix_caja_monto_esperado.sql` | Fix: elimina doble conteo en caja_monto_esperado |

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

### Continuación de sesión (día anterior sin cerrar)

```
Día anterior                Día actual
  │                            │
  └→ Sesión abierta ──────────→ Banner "Caja del día anterior"
                                 │
                                 ├→ Continuar: cerrar + abrir nueva con saldo
                                 └→ Cerrar y abrir: cerrar con monto contado + abrir nueva
```

---

## Restricciones importantes

- **Solo puede haber una sesión abierta a la vez** (unique partial index en estado='abierta').
- Si intentás abrir una segunda sesión → error de constraint.
- Cerrar la sesión no impide crear movimientos o ventas retroactivos, pero normalmente primero se cierran todos los movimientos del día.
- **Una sesión puede abarcar varios días** si no se cierra. El campo `fecha` indica el día de apertura.

---

## Movimientos automáticos

La caja registra movimientos automáticamente al:

| Operación | Tipo movimiento | Concepto generado |
|-----------|----------------|-------------------|
| Venta POS | ingreso | "Venta {numero} - {MetodoPago}" |
| Anulación de venta | egreso | "Anulación venta {numero} - {MetodoPago}" |
| Confirmar orden | ingreso | "Orden {numero} - {MetodoPago}" |
| Anular orden confirmada | egreso | "Anulación orden {numero} - {MetodoPago}" |
| Continuación de sesión | ingreso | "Continuación de caja anterior (Sesión #X)" |

Solo se registran los pagos que **no son CUENTA_CORRIENTE** (esos van a cobranzas, no a caja).

---

## Caja en órdenes de venta y óptica

Al confirmar una orden, si no hay caja abierta, se **crea automáticamente** una sesión con `monto_apertura = 0` (filtrada por sucursal). Esto aplica también a:
- Pago de OV (`/api/dashboard/ordenes/[id]/pago`)
- Anticipo de OT (`/api/dashboard/optica/ordenes`)
- Anticipo de SV (`/api/dashboard/optica/servicios`)

La sesión siempre se busca/filtra por `sucursal_id` para evitar mezclar fondos entre sucursales.

---

## Monto esperado al cierre

La función SQL `caja_monto_esperado(sesion_id)` calcula:
```
monto_apertura
+ suma caja_movimientos ingreso
- suma caja_movimientos egreso
```

**Nota:** Solo suma movimientos de `caja_movimientos` (no venta_pagos directamente).
Esto evita el doble conteo porque las rutas de venta/OT/SV/OV ya insertan en `caja_movimientos` al registrar pagos.

Al cerrar, el sistema muestra la diferencia entre lo físico (`monto_cierre`) y lo calculado (`monto_esperado`).

---

## Anulación de movimientos

Los movimientos pueden anularse con permiso `fondos.caja.anular`:
- Se crea un movimiento inverso (ingreso → egreso o viceversa)
- Se registra en `caja_movimientos_log` con motivo y usuario
- No se pueden anular movimientos de tipo "Apertura"
- Los movimientos de tipo "Anulación" o "Continuación" tampoco se pueden anular

### Anulación desde otras rutas (ventas, OV)

Al anular una venta u OV confirmada, el sistema verifica si la sesión de caja original sigue abierta:
- Si está abierta → el egreso se registra en esa sesión
- Si está cerrada → el egreso se registra en la sesión actual abierta de la misma sucursal

Esto evita que anulaciones modifiquen sesiones ya cerradas y contabilizadas.

---

## Archivos adicionales (reglas de caja en otras rutas)

| Archivo | Regla de caja |
|---------|---------------|
| `app/api/dashboard/ventas/route.ts` | Auto-create sesión si no existe, inserta caja_movimientos por cada pago no-CC/no-NC |
| `app/api/dashboard/ventas/[id]/anular/route.ts` | Revierte a sesión abierta actual (no a sesión cerrada original) |
| `app/api/dashboard/ordenes/[id]/pago/route.ts` | Auto-create sesión filtrada por sucursal |
| `app/api/dashboard/ordenes/[id]/confirmar/route.ts` | Excluye NC del filtro, filtra por sucursal, auto-create |
| `app/api/dashboard/ordenes/[id]/anular/route.ts` | Revierte a sesión abierta de la sucursal |
| `app/api/dashboard/optica/ordenes/route.ts` | Auto-create sesión para anticipo OT |
| `app/api/dashboard/optica/servicios/route.ts` | Auto-create sesión para anticipo SV |
| `app/api/dashboard/listados/movimientos-caja/route.ts` | Listado de movimientos: agrega 5 fuentes, filtra por sucursal |
| `app/api/dashboard/caja/movimientos-por-dia/route.ts` | Movimientos del día: agrega 5 fuentes, filtra por sucursal |

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
  fecha: string                    // YYYY-MM-DD (día de apertura)
  sesion_anterior_id: number | null // sesión del día anterior
}

type CajaMovimiento = {
  id: number
  sesion_id: number
  tipo: TipoMovCaja
  tipo_concepto: string | null
  concepto: string
  monto: number
  usuario_id: string
  created_at: string
}

type CajaMovimientoLog = {
  id: number
  movimiento_id: number
  sesion_id: number
  accion: 'anulacion'
  tipo: TipoMovCaja
  tipo_concepto: string | null
  concepto: string
  monto: number
  usuario_original: string
  motivo: string
  usuario_anula: string
  created_at: string
}
```

---

## Permisos

| Permiso | Descripción |
|---------|-------------|
| `fondos.caja.ver` | Ver estado de caja |
| `fondos.caja.abrir` | Abrir caja |
| `fondos.caja.cerrar` | Cerrar caja |
| `fondos.caja.movimiento` | Registrar ingreso/egreso |
| `fondos.caja.anular` | Anular movimientos (solo admin) |
| `listados.movimientos_caja.ver` | Ver listado de movimientos de caja |

---

## Listado de movimientos de caja

### API `GET /api/dashboard/listados/movimientos-caja`

Agrega pagos de **5 fuentes** en un solo listado:

1. **caja_movimientos** — movimientos directos de caja (ingreso/egreso manual)
2. **venta_pagos** → ventas — pagos de ventas POS completadas
3. **orden_venta_pagos** → ordenes_venta — pagos de OV no anuladas
4. **optica_orden_pagos** → optica_ordenes — pagos de OT
5. **optica_servicio_pagos** → optica_servicios — pagos de SV

**Parámetros:** `desde` (YYYY-MM-DD), `hasta` (YYYY-MM-DD), `sucursal_id` (opcional, solo admin)

**Filtrado por sucursal (crítico):**
- Sin `sucursal_id` → usa `getHomeSucursalId()` → solo muestra la sucursal activa
- Con `sucursal_id` → filtra el padre por esa sucursal
- Para OT/SV: si el padre fue filtrado, el pago se salta (`if (!o) continue`)

**Respuesta:**
```typescript
type MovimientosResponse = {
  movimientos: MovRow[]
  total_ingresos: number
  total_egresos: number
  saldo: number
}
```

### Página de impresión

`(print)/dashboard/listados/movimientos-caja/print/page.tsx`

- Carga datos con los mismos filtros de la página principal
- Header: logo de sucursal (via `/api/dashboard/sucursales/selected`) + nombre
- Tabla agrupada por día con tipo (ingreso/egreso), concepto, fuente, método, monto
- Toolbar: Cerrar / Imprimir / Guardar PDF

---

*Última actualización: 2026-07-14*
