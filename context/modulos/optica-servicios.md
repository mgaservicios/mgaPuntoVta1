# optica-servicios.md — Servicios Óptica (Reparaciones / Ajustes)

Adjuntá este archivo para trabajar en el módulo de servicios óptica
(reparaciones, ajustes, pulidos, seguimiento y pagos).

Para el módulo de Órdenes de Trabajo ver [`optica-ordenes.md`](optica-ordenes.md).

---

## Archivos del módulo

| Archivo | Descripción |
|---------|-------------|
| `app/(dashboard)/dashboard/optica/servicios/page.tsx` | Server wrapper — lee `isAdmin` del session y pasa al client |
| `app/(dashboard)/dashboard/optica/servicios/_client.tsx` | Lista de servicios (client component) con filtros, vista rápida, pago rápido e icono imprimir |
| `app/(dashboard)/dashboard/optica/servicios/[id]/page.tsx` | Detalle/edición completa del servicio — tipos de reparación, costos, tareas, pagos |
| `app/(dashboard)/dashboard/optica/servicios/[id]/print/page.tsx` | Vista de impresión / PDF — código de barras, tipos, totales, pagos |
| `app/api/dashboard/optica/servicios/route.ts` | GET (lista filtrada) + POST (crear servicio) |
| `app/api/dashboard/optica/servicios/[id]/route.ts` | GET + PUT (edición parcial/completa) + DELETE (solo admin) |
| `app/api/dashboard/optica/servicios/[id]/cambiar-estado/route.ts` | POST — cambiar a `entregado` o `anulado` |
| `app/api/dashboard/optica/servicios/[id]/tareas/route.ts` | GET + POST (crear tarea) |
| `app/api/dashboard/optica/servicios/[id]/tareas/[tareaId]/route.ts` | PUT (editar tarea) + DELETE (eliminar tarea) |
| `app/api/dashboard/optica/servicios/[id]/pago/route.ts` | POST — registrar pago |
| `types/optica.ts` | Tipos TypeScript (compartido con OT) |
| `supabase/migrations/optica_servicios.sql` | DDL de las 4 tablas nuevas |

---

## Tablas de base de datos

### `optica_servicios`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| numero | text UNIQUE NOT NULL | Ej: `SV-00001` |
| fecha | date | default `current_date` |
| fecha_prometida | date | Fecha de entrega prometida |
| cliente_id | bigint NOT NULL | FK → clientes(id) — **obligatorio** (validado en frontend y API) |
| detalle | text | Descripción general del trabajo a realizar |
| observaciones | text | Notas internas |
| costo_trabajo | numeric(12,2) | Mano de obra / costo general manual |
| subtotal | numeric(12,2) | sum(tipos.precio) + costo_trabajo |
| descuento_pct | numeric(5,2) | |
| descuento_monto | numeric(12,2) | |
| total | numeric(12,2) | subtotal − descuento_monto |
| anticipo | numeric(12,2) | Seña informativa al crear |
| estado | text | CHECK: ver ciclo de vida abajo |
| sucursal_id | bigint | FK → sucursales(id) |
| created_by | uuid NOT NULL | FK → users(id) |
| created_at / updated_at | timestamptz | |

---

### `optica_servicio_tipos`

Líneas de tipo de reparación. Cada servicio puede tener uno o más.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| servicio_id | bigint NOT NULL | FK → optica_servicios(id) ON DELETE CASCADE |
| tipo | text NOT NULL | CHECK: ver `TipoServicio` abajo |
| detalle | text | Descripción específica del trabajo para ese tipo |
| precio | numeric(12,2) | Precio individual del tipo. Suma al subtotal |

Tipos válidos: `garantia`, `soldadura`, `patillas`, `plaquetas`, `terminales`, `tanza`, `cristales`, `embutir_bisgra`, `pase_armazon`, `cambio_cristales_sol_neutros`, `otros`.

---

### `optica_servicio_tareas`

Tareas de seguimiento interno (sin campos de laboratorio, a diferencia de OT).

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| servicio_id | bigint NOT NULL | FK → optica_servicios(id) ON DELETE CASCADE |
| titulo | text NOT NULL | |
| descripcion | text | |
| estado | text | CHECK: `'en_proceso'`, `'terminada'` |
| fecha | date | Fecha de inicio |
| fecha_fin | date | Se completa al marcar como `terminada` |
| usuario_id | uuid | FK → users(id) — responsable |
| created_by | uuid | FK → users(id) |
| created_at / updated_at | timestamptz | |

> **⚠️ PostgREST gotcha:** `optica_servicio_tareas` tiene DOS FK a `users` (`usuario_id` y `created_by`).
> Usar siempre `users!usuario_id(name, email)` en los `.select()`. Igual que en `optica_orden_tareas`.

---

### `optica_servicio_pagos`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| servicio_id | bigint NOT NULL | FK → optica_servicios(id) ON DELETE CASCADE |
| caja_sesion_id | bigint | FK → caja_sesiones(id) — nullable |
| metodo | text | CHECK: ver `MetodoPagoOptica` |
| monto | numeric(12,2) | Puede ser negativo (pago de anulación) |
| concepto | text | Descripción libre, o `'ANULACION SV SV-XXXXX'` para pagos de anulación |
| referencia | text | |
| fecha_pago | date | default `current_date` |
| usuario_id | uuid | FK → users(id) |
| created_at | timestamptz | |

---

## Ciclo de vida del estado

```
                ┌─────────┐
                │PENDIENTE│ (creación / sin tareas)
                └────┬────┘
                     │ agregar tarea
                     ▼
               ┌──────────┐
               │EN_PROCESO│ ──── cambiar-estado: anulado ──► ANULADO (final)
               └─────┬────┘
                     │ todas las tareas terminadas
                     ▼
               ┌──────────┐
               │ TERMINADO│ ──── cambiar-estado: entregado ──► ENTREGADO (final)
               └──────────┘
```

**Transiciones automáticas** al guardar/eliminar una tarea:
- Sin tareas → `pendiente`
- Alguna tarea `en_proceso` → `en_proceso`
- Todas `terminada` → `terminado`

**Transiciones manuales** (`POST /cambiar-estado`): solo `entregado` y `anulado`.

A diferencia de las OT, **no existe el estado `en_laboratorio`**. Las tareas son simples (`en_proceso` / `terminada`).

---

## Reglas de negocio y niveles de edición

### Cliente obligatorio

El campo `cliente_id` es **requerido** en creación y edición completa. El frontend
valida antes de guardar y muestra un toast de error si no hay cliente seleccionado.

### Quién puede qué según estado

| Estado SV | Editar campos | Agregar tarea | Editar/eliminar tarea | Pagar | Anular | Entregar |
|-----------|--------------|---------------|-----------------------|-------|--------|----------|
| pendiente | Todo | ✅ | ✅ | ✅ | ✅ | ✗ |
| en_proceso | Solo `fecha_prometida` | ✅ | ✅ | ✅ | ✅ | ✗ |
| terminado | Solo `fecha_prometida` | ✅ | ✅ | ✅ | ✅ | ✅ |
| entregado | ✗ (readonly) | ✗ | ✗ | ✅ (si saldo > 0) | ✗ | — |
| anulado | ✗ (bloqueado) | ✗ | ✗ | ✗ | — | — |

### Derivación en el frontend (`[id]/page.tsx`)

```typescript
const tieneTareas          = tareas.length > 0
const esFinalizado         = ['terminado', 'entregado'].includes(estadoSV)
const esAnulado            = estadoSV === 'anulado'
const esReadonly           = esFinalizado || esAnulado
const esSoloFechaPrometida = !isNueva && !esReadonly && tieneTareas
const puedeAgregarPago     = !esAnulado && saldo > 0.005
const disabledEdit         = esReadonly || esSoloFechaPrometida
```

---

## Layout del formulario

Secciones en orden:

1. **Datos generales** — Fecha, Fecha prometida, Cliente (obligatorio), Teléfono, **Detalle** (textarea general del trabajo)
2. **Tipos de reparación** — Selector múltiple (botones toggle), por cada tipo seleccionado: campo Detalle (descripción específica) + Precio
3. **Costos** — Costo de trabajo, Subtotal, Descuento %, Descuento $, Total / Seña (al crear) / Saldo (al editar)
4. **Observaciones** — Notas internas
5. **Tareas** — Solo visible en edición. Lista + formulario inline (Título, Estado, Descripción)
6. **Pagos** — Solo visible en edición. Tabla + formulario inline

---

## Lógica de cálculo

```
subtotal_tipos  = sum(optica_servicio_tipos.precio)
subtotal        = subtotal_tipos + costo_trabajo
descuento_monto = subtotal × descuento_pct / 100  (o entrada manual — bidireccional)
total           = subtotal − descuento_monto
saldo           = total − sum(optica_servicio_pagos.monto)
```

Los montos negativos en pagos (anulaciones) se **suman** al total pagado, reduciendo el saldo a cero.

---

## Numeración

Correlativo `SV-XXXXX` generado en el API (`POST /servicios`):

```typescript
const { count } = await supabase
  .from('optica_servicios')
  .select('id', { count: 'exact', head: true })
const numero = `SV-${String((count ?? 0) + 1).padStart(5, '0')}`
```

---

## Impresión / Generación de PDF

### Dónde está disponible el botón Imprimir

| Lugar | Comportamiento |
|-------|----------------|
| Topbar del formulario de edición | Botón "Imprimir" — abre `/print` en pestaña nueva |
| Lista de servicios — columna acciones | Ícono `Printer` (violeta) junto a ojo y lápiz |
| Dialog de vista rápida (`ServicioViewDialog`) | Botón "Imprimir" en el pie del dialog |
| Al crear un servicio nuevo y guardar | Dialog "¿Deseas imprimir el servicio?" — si confirma, abre `/print` y navega al servicio |

### Página de impresión (`[id]/print/page.tsx`)

Client component que:
1. Carga el servicio via `GET /api/dashboard/optica/servicios/{id}`
2. Genera código de barras CODE128 con **jsbarcode**
3. Muestra barra de acción (Imprimir / Cerrar) oculta con `print:hidden`
4. Llama `window.print()` para generar PDF

**Estructura del documento:**
```
ENCABEZADO (logo + código de barras + cliente + NRO SV + fecha + estado + total/saldo)
DATOS DEL CLIENTE
DETALLE DEL TRABAJO (si hay texto en el campo detalle)
TIPOS DE REPARACIÓN (tabla: tipo, descripción, precio)
TOTALES (subtotal reparaciones, costo trabajo, descuento, TOTAL)
SEÑAS / PAGOS (tabla + resumen pagado / saldo)
OBSERVACIONES (si hay texto)
PIE (número SV · fecha de emisión)
```

---

## Flujo de creación

```
1. Usuario carga: cliente (obligatorio), fecha, fecha prometida, detalle
2. Selecciona tipos de reparación (uno o más) con descripción y precio por tipo
3. Ajusta costo de trabajo, descuento, seña/anticipo
4. POST /api/dashboard/optica/servicios
5. API genera número SV-XXXXX, asigna sucursal_id, created_by
6. Si anticipo_metodo → registra primer pago + movimiento de caja
7. Retorna { id, numero } → dialog "¿Deseas imprimir?"
   - Sí → abre /print en nueva pestaña + navega a /servicios/{id}
   - No → navega directamente a /servicios/{id}
```

---

## Flujo de pagos

`POST /api/dashboard/optica/servicios/[id]/pago`

- Inserta en `optica_servicio_pagos`
- Asocia a la caja abierta de la sucursal activa (`caja_sesion_id`)
- Si no hay caja abierta, la crea automáticamente
- Registra `caja_movimientos` (excepto método `CUENTA_CORRIENTE`)

---

## Anulación

`POST /api/dashboard/optica/servicios/[id]/cambiar-estado` con `{ estado: 'anulado' }`

Si `saldo > 0.005` al anular, se genera automáticamente un pago negativo:
```
monto    = −saldo
concepto = 'ANULACION SV SV-XXXXX'
metodo   = 'OTRO'
```

---

## Eliminación (solo Administrador)

`DELETE /api/dashboard/optica/servicios/[id]`

- Solo si la sesión es `Administrador` (403 si no)
- Solo si el servicio no tiene tareas ni pagos (409 si tiene)
- Inserta en `eliminaciones_log` con `tipo = 'optica_servicio'` antes de eliminar
- El botón Trash2 en la lista solo se muestra a admins cuando no hay tareas ni pagos

---

## Multi-sucursal

- Los servicios se filtran por `sucursal_id` según la cookie activa
- Si el admin tiene "ver todas" activado, se muestran todas las sucursales
- Los pagos se asocian a la caja abierta de la sucursal activa al momento del pago

---

## Tipos TypeScript (`types/optica.ts`)

```typescript
type EstadoServicio      = 'pendiente' | 'en_proceso' | 'terminado' | 'entregado' | 'anulado'
type EstadoTareaServicio = 'en_proceso' | 'terminada'
type TipoServicio        =
  | 'garantia' | 'soldadura' | 'patillas' | 'plaquetas' | 'terminales'
  | 'tanza' | 'cristales' | 'embutir_bisgra' | 'pase_armazon'
  | 'cambio_cristales_sol_neutros' | 'otros'
// MetodoPagoServicio = MetodoPagoOptica (mismo enum)
```

Constantes exportadas: `ESTADO_SERVICIO_LABELS`, `ESTADO_SERVICIO_BADGE`, `TIPO_SERVICIO_LABELS`, `TIPOS_SERVICIO_LIST`.

Interfaces: `OpticaServicio`, `OpticaServicioTipo`, `OpticaServicioTarea`, `OpticaServicioPago`.

---

## Gotchas y notas técnicas

1. **FK a `users` en tareas:** `optica_servicio_tareas` tiene DOS FK a `users` (`usuario_id`, `created_by`). Usar siempre `users!usuario_id(name, email)` en `.select()`.

2. **FKs a `public.users` no `auth.users`:** Las FK de `optica_servicio_tareas`, `optica_servicio_pagos` y `optica_servicios.created_by` deben referenciar `public.users(id)`, no `auth.users(id)`. PostgREST solo ve el schema público.

3. **jsbarcode CLIENT ONLY:** `import JsBarcode from 'jsbarcode'` solo en `'use client'`. Si se importa en server component el build falla.

4. **Tipos como toggle:** Los tipos de reparación se seleccionan como botones toggle en el formulario. Cada tipo seleccionado genera una fila en `optica_servicio_tipos`. Al guardar con edición completa, se hace DELETE + INSERT de todos los tipos.

5. **Precio por tipo vs costo_trabajo:** Cada tipo tiene su propio precio individual. El `costo_trabajo` es un campo adicional de mano de obra general. Ambos suman al subtotal.

---

*Última actualización: 2026-06-04*
