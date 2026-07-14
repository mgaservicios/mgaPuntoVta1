# listados.md — Listados e Informes

Adjuntá este archivo para trabajar en el módulo de listados (reportes, consultas y movimientos de caja).

---

## Archivos del módulo

| Archivo | Descripción |
|---------|-------------|
| `app/(dashboard)/dashboard/listados/cobranzas/page.tsx` | Listado de cuenta corriente de clientes |
| `app/(dashboard)/dashboard/listados/ventas-articulos/page.tsx` | Listado de venta de artículos (con filtros) |
| `app/(dashboard)/dashboard/listados/ventas-articulos/print/page.tsx` | Página de impresión / PDF de ventas de artículos |
| `app/api/dashboard/listados/ventas-articulos/route.ts` | API: datos de ventas agrupados por día |
| `app/(dashboard)/dashboard/listados/precios/page.tsx` | Lista de precios por lista (con filtros) |
| `app/(print)/dashboard/listados/precios/print/page.tsx` | Página de impresión / PDF de precios |
| `app/(dashboard)/dashboard/listados/movimientos-caja/page.tsx` | Movimientos de caja (ingresos/egresos por fuente) |
| `app/(print)/dashboard/listados/movimientos-caja/print/page.tsx` | Página de impresión / PDF de movimientos de caja |
| `app/api/dashboard/listados/movimientos-caja/route.ts` | API: movimientos de 5 fuentes (caja, OV, OT, SV, ventas POS) |
| `app/api/dashboard/sucursales/selected/route.ts` | API: sucursal activa (id, nombre, logo_url, isHome, verTodas) |
| `components/pago/FormasPagoCobro.tsx` | Componente unificado de formas de pago para OV/OT/OS |
| `lib/perm-groups.ts` | Permisos `listados.*` + `ROUTE_TO_PERM` |
| `components/dashboard/Sidebar.tsx` | Grupo "Listados" en el sidebar |
| `components/dashboard/ModuleSections.tsx` | Sección "Listados" en el dashboard grid |

---

## Listados disponibles

### Movimientos de caja (`/dashboard/listados/movimientos-caja`)

Agrega pagos de **5 fuentes** en un solo listado:

| Fuente | Tabla pagos | Tabla padre | Campos relevantes |
|--------|------------|-------------|-------------------|
| Caja (movimientos directos) | `caja_movimientos` | `caja_sesiones` | tipo, concepto, monto, tipo_concepto |
| Ventas POS | `venta_pagos` | `ventas` | metodo, monto, estado=completada |
| Órdenes de venta | `orden_venta_pagos` | `ordenes_venta` | metodo, monto, estado!=anulada |
| Óptica OT | `optica_orden_pagos` | `optica_ordenes` | metodo, monto, referencia |
| Óptica SV | `optica_servicio_pagos` | `optica_servicios` | metodo, monto, referencia |

**Filtros:** desde, hasta (requeridos), sucursal (solo admin).

**Filtros de sucursal (crítico):**
- Sin sucursal seleccionada ("actual") → usa `getHomeSucursalId()` → solo muestra movimientos de la sucursal activa
- Admin selecciona sucursal → filtra por `sucursal_id` del padre (OV, OT, SV, ventas)
- Para OT y SV: si el padre fue filtrado por sucursal, el pago se **salta** (`if (!o) continue`) — no se agrega al listado

**Respuesta:** `{ movimientos: MovRow[], total_ingresos, total_egresos, saldo }`

**Movimientos de caja en el día (`/api/dashboard/caja/movimientos-por-dia`):**
Mismo patrón de filtrado por sucursal — usado en el panel principal de caja.

---

### Venta de artículos (`/dashboard/listados/ventas-articulos`)

Muestra artículos vendidos, agrupados por día.

**API:** `GET /api/dashboard/listados/ventas-articulos?desde=&hasta=&tipo=`
- tipo: `todos` | `venta` | `receta` (default: `todos`)
- Respuesta: array de `{ fecha, tipo, comprobante, cliente, articulo, variante, cantidad }`

**Formato de comprobante:**
- `v.numero` ya incluye el prefijo (ej: `V-01-00003`) — nunca se agrega `V-` por separado
- `o.numero` de OV incluye `OV-01-00037`
- `o.numero` de OT incluye `OT-01-00037`

---

### Lista de precios (`/dashboard/listados/precios`)

Muestra artículos agrupados por lista de precio.

**Filtros:** lista de precio (obligatoria), categoría, proveedor, solo con stock, búsqueda.

**Página de impresión** (`(print)/dashboard/listados/precios/print/page.tsx`):
- Header con logo de sucursal + nombre + filtros aplicados
- Tabla agrupada por lista, con precio y variante (columna oculta si no hay variantes)
- Toolbar con Cerrar/Imprimir

---

### Cta. Cte. Clientes (`/dashboard/listados/cobranzas`)

Listado de cuenta corriente de clientes con saldos y movimientos.

---

## Patrón de impresión de listados

Todas las páginas de impresión de listados siguen el mismo patrón:

1. **Ruta:** `(print)/dashboard/listados/{nombre}/print/page.tsx` — el route group `(print)` NO agrega segmento URL
2. **Carga de sucursal:** `fetch('/api/dashboard/sucursales/selected')` → `{ id, nombre, logo_url, isHome, verTodas }`
3. **Logo:** componente `Logo` de `components/Logo.tsx` — acepta prop `url?: string | null`
4. **Toolbar:** barra fija arriba con Cerrar + Imprimir (oculta con `print:hidden`)
5. **CSS:** `@media print { @page { size: A4 portrait; margin: 10mm; } }`

---

## Permisos

| Permiso | Descripción |
|---------|-------------|
| `listados.cobranzas.ver` | Ver listado de cuenta corriente |
| `listados.ventas_articulos.ver` | Ver listado de ventas por artículo |
| `listados.precios.ver` | Ver lista de precios |
| `listados.movimientos_caja.ver` | Ver movimientos de caja |

Todos bajo el módulo BD `listados` (empresa_modulos.modulo).

---

## Mapeo de rutas a permisos (`lib/perm-groups.ts`)

```
/dashboard/listados/cobranzas          → listados.cobranzas.ver
/dashboard/listados/ventas-articulos   → listados.ventas_articulos.ver
/dashboard/listados/precios            → listados.precios.ver
/dashboard/listados/movimientos-caja   → listados.movimientos_caja.ver
```

---

## Componente FormasPagoCobro

`components/pago/FormasPagoCobro.tsx`

Componente unificado para selector de formas de pago, usado en:
- Órdenes de venta (OV) — `ventas/ordenes/[id]/page.tsx`
- Órdenes de trabajo (OT) — `optica/ordenes/[id]/page.tsx`
- Servicios (OS) — `optica/servicios/[id]/page.tsx`

**Props principales:**
```typescript
type FormasPagoCobroProps = {
  total: number
  totalPagado: number
  onChange: (pagos: PagoState[]) => void
 _pagosIniciales?: PagoState[]
}
```

**Cálculo de saldo y recargo:**
```
saldo = max(0, total - totalPagado)
recargo = round(saldo * pct / 100 * 100) / 100
```

El recargo se calcula sobre el **saldo** (no sobre el total). La cuota se calcula como `(saldo + recargo) / cantCuotas`.

---

## Multi-sucursal en listados

- **Movimientos de caja:** filtra por sucursal del padre (OV/OT/SV/ventas) — admin puede cambiar sucursal
- **Venta de artículos:** filtra por `ventas.sucursal_id`
- **Lista de precios:** no filtra por sucursal (precios son globales)
- **Cta. Cte.:** filtra por sucursal del cobro/venta

---

*Última actualización: 2026-07-14*
