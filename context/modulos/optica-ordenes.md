# optica-ordenes.md — Órdenes de Trabajo Óptica

Adjuntá este archivo para trabajar en el módulo de OT óptica (graduación, artículos de stock, tareas con laboratorio, impresión).

Para el módulo de **Servicios** (reparaciones / ajustes) ver [`optica-servicios.md`](optica-servicios.md).

---

## Archivos del módulo

| Archivo | Descripción |
|---------|-------------|
| `app/(dashboard)/dashboard/optica/ordenes/page.tsx` | Server wrapper — lee `isAdmin` del session y pasa al client |
| `app/(dashboard)/dashboard/optica/ordenes/_client.tsx` | Lista de OT (client component) con filtros, vista rápida, pago rápido e **icono imprimir** |
| `app/(dashboard)/dashboard/optica/ordenes/[id]/page.tsx` | Detalle/edición completa de la OT — layout compacto, labels al costado, selector de lista de precios |
| `app/(dashboard)/dashboard/optica/ordenes/[id]/print/page.tsx` | **Vista de impresión / PDF** — genera el documento con código de barras, logo, graduación, artículos, pagos |
| `app/(dashboard)/dashboard/optica/medicos/page.tsx` | ABM de médicos |
| `app/(dashboard)/dashboard/optica/_components/ItemRow.tsx` | Fila de artículo en la OT — acepta `listaId` y lo pasa a ArmazonSearch |
| `app/(dashboard)/dashboard/optica/_components/ArmazonSearch.tsx` | Buscador de artículos de stock — acepta `listaId`; al seleccionar, consulta el precio de la lista elegida |
| `app/(dashboard)/dashboard/optica/_components/UsoToggle.tsx` | Toggle lejos/cerca/ambos |
| `app/(dashboard)/dashboard/optica/_components/MedicoSearch.tsx` | Buscador de médicos |
| `app/api/dashboard/optica/ordenes/route.ts` | GET (lista filtrada) + POST (crear OT) |
| `app/api/dashboard/optica/ordenes/[id]/route.ts` | GET + PUT (edición parcial/completa) + DELETE (solo admin) |
| `app/api/dashboard/optica/ordenes/[id]/cambiar-estado/route.ts` | POST — cambiar a `entregado` o `anulado` |
| `app/api/dashboard/optica/ordenes/[id]/tareas/route.ts` | GET + POST (crear tarea) |
| `app/api/dashboard/optica/ordenes/[id]/tareas/[tareaId]/route.ts` | PUT (editar tarea) + DELETE (eliminar tarea) |
| `app/api/dashboard/optica/ordenes/[id]/pago/route.ts` | POST — registrar pago |
| `app/api/dashboard/optica/ordenes/upload-receta/route.ts` | POST — subir imagen de receta |
| `app/api/dashboard/optica/medicos/route.ts` | GET + POST medicos |
| `app/api/dashboard/optica/medicos/[id]/route.ts` | PUT + DELETE medicos |
| `types/optica.ts` | Tipos TypeScript |

---

## Tablas de base de datos

### `optica_medicos`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| nombre | text NOT NULL | |
| matricula | text | |
| telefono | text | |
| activo | boolean | default true |
| created_at | timestamptz | |

---

### `optica_ordenes`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| numero | text UNIQUE NOT NULL | Ej: `OT-00001` |
| fecha | date | default `current_date` |
| fecha_prometida | date | Fecha de entrega prometida al cliente |
| cliente_id | bigint | FK → clientes(id) — nullable |
| medico_id | bigint | FK → optica_medicos(id) — nullable |
| medico_nombre | text | Alternativa libre si el médico no está en el catálogo |
| receta_url | text | URL de imagen de receta subida a Supabase Storage |
| lejos_od_esfera / _cilindro / _eje | numeric / smallint | Graduación lejos OD |
| lejos_oi_esfera / _cilindro / _eje | numeric / smallint | Graduación lejos OI |
| cerca_od_esfera / _cilindro / _eje | numeric / smallint | Graduación cerca OD |
| cerca_oi_esfera / _cilindro / _eje | numeric / smallint | Graduación cerca OI |
| adicion | numeric(4,2) | Adición para bifocales/progresivos |
| dp | numeric(5,2) | Distancia pupilar |
| estado | text | Ver ciclo de vida abajo |
| pedido_a | text | A quién se realizó el pedido (lab externo, etc.) |
| observaciones | text | |
| costo_trabajo | numeric(12,2) | Costo manual de trabajo óptico (mano de obra) |
| anticipo | numeric(12,2) | Anticipo recibido al momento de la OT |
| subtotal | numeric(12,2) | sum(items) + costo_trabajo |
| descuento_pct | numeric(5,2) | |
| descuento_monto | numeric(12,2) | |
| total | numeric(12,2) | subtotal − descuento_monto |
| sucursal_id | bigint | FK → sucursales(id) — filtra la lista por sucursal activa |
| created_by | uuid NOT NULL | FK → users(id) |
| created_at / updated_at | timestamptz | |

---

### `optica_orden_items`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| orden_id | bigint NOT NULL | FK → optica_ordenes(id) ON DELETE CASCADE |
| tipo | text | CHECK: `'armazon'`, `'cristal'`, `'tratamiento'`, `'otro'` |
| uso | text | CHECK: `'lejos'`, `'cerca'`, `'ambos'` — null para tratamientos/otro |
| nombre | text NOT NULL | Nombre del producto (snapshot o libre) |
| armazon_propio | boolean | Armazón traído por el cliente (no descuenta stock) |
| articulo_id | bigint | FK → articulos(id) — nullable |
| variante_id | bigint | FK → articulo_variantes(id) — nullable |
| cantidad | numeric(10,3) | |
| precio_unitario | numeric(12,2) | |
| descuento_pct | numeric(5,2) | |
| subtotal | numeric(12,2) | cantidad × precio × (1 − descuento/100) |
| notas | text | |

---

### `optica_orden_tareas`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| orden_id | bigint NOT NULL | FK → optica_ordenes(id) ON DELETE CASCADE |
| titulo | text NOT NULL | |
| descripcion | text | |
| estado | text | CHECK: `'en_proceso'`, `'en_laboratorio'`, `'terminada'` |
| fecha | date | Fecha de inicio |
| fecha_fin | date | Se completa al marcar como `terminada` |
| usuario_id | uuid | FK → users(id) — responsable de la tarea |
| laboratorio_nombre | text | Nombre del laboratorio (si aplica) |
| laboratorio_tipo | text | CHECK: `'propio'`, `'externo'` |
| created_by | uuid | FK → users(id) |
| created_at / updated_at | timestamptz | |

> **⚠️ PostgREST gotcha:** `optica_orden_tareas` tiene DOS FK a `users` (`usuario_id` y `created_by`).
> Siempre usar la sintaxis de FK explícita: `users!usuario_id(name, email)` — no `users(name, email)`.
> Si se usa la forma corta, PostgREST devuelve error 500 por ambigüedad.

---

### `optica_orden_pagos`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| orden_id | bigint NOT NULL | FK → optica_ordenes(id) ON DELETE CASCADE |
| caja_sesion_id | bigint | FK → caja_sesiones(id) — la caja abierta al momento del pago |
| metodo | text | CHECK: ver `MetodoPagoOptica` |
| monto | numeric(12,2) | Puede ser negativo (pago de anulación) |
| concepto | text | Descripción libre, o `'ANULACION OT OT-XXXXX'` para pagos de anulación |
| referencia | text | |
| fecha_pago | date | default `current_date` |
| usuario_id | uuid | FK → users(id) |
| created_at | timestamptz | |

---

## Ciclo de vida del estado

```
                ┌─────────┐
                │ NUEVO   │ (creación)
                └────┬────┘
                     │ crear OT
                     ▼
               ┌──────────┐
         ┌──── │ PENDIENTE │ ────┐
         │     └──────────┘     │
         │  agregar tarea        │ cambiar-estado: anulado
         │     ▼                 │
     ┌──────────┐          ┌──────────┐
     │ EN_PROCESO│          │ ANULADO  │ (final — bloqueado)
     └─────┬─────┘          └──────────┘
           │ tarea → en_lab
           ▼
     ┌──────────────┐
     │ EN_LABORATORIO│
     └──────┬────────┘
            │ todas las tareas terminadas
            ▼
       ┌──────────┐
       │ TERMINADO │ ──── cambiar-estado: entregado ──► ENTREGADO (final)
       └──────────┘
```

**Transiciones automáticas:** El estado de la OT se recalcula automáticamente al guardar o eliminar una tarea:
- Sin tareas → `pendiente`
- Alguna tarea `en_laboratorio` → `en_laboratorio`
- Resto en proceso → `en_proceso`
- Todas `terminada` → `terminado`

**Transiciones manuales** (`POST /cambiar-estado`): solo `entregado` y `anulado`.

---

## Reglas de negocio y niveles de edición

### Quién puede qué según estado

| Estado OT | Editar campos | Agregar tarea | Editar/eliminar tarea | Pagar | Anular | Entregar |
|-----------|--------------|---------------|-----------------------|-------|--------|----------|
| pendiente | Todo | ✅ | ✅ | ✅ (si saldo > 0) | ✅ | ✗ |
| en_proceso | Solo `fecha_prometida` | ✅ | ✅ | ✅ | ✅ | ✗ |
| en_laboratorio | Solo `fecha_prometida` | ✅ | ✅ | ✅ | ✅ | ✗ |
| terminado | Solo `fecha_prometida` | ✅ | ✅ | ✅ | ✅ | ✅ |
| entregado | ✗ (readonly) | ✗ | ✗ | ✅ (si saldo > 0) | ✗ | — |
| anulado | ✗ (bloqueado) | ✗ | ✗ | ✗ | — | — |

> "Solo `fecha_prometida`" = la OT tiene tareas activas. El PUT API detecta `tieneTareas` y restringe la actualización solo a ese campo.

### Derivación en el frontend (page.tsx detalle)

```typescript
const tieneTareas         = tareas.length > 0
const esFinalizado        = ['terminado', 'entregado'].includes(estadoOT)
const esAnulado           = estadoOT === 'anulado'
const esReadonly          = esFinalizado || esAnulado
const esSoloFechaPrometida = !isNueva && !esReadonly && tieneTareas
const puedeAgregarPago    = !esAnulado && saldo > 0.005
const disabledEdit        = esReadonly || esSoloFechaPrometida
```

- Todos los campos usan `disabled={disabledEdit}` excepto `fecha_prometida` que usa `disabled={esReadonly}`.
- Botón "Guardar OT" siempre dice "Guardar OT" (no "Actualizar fecha" — confunde al usuario).
- Si `esSoloFechaPrometida`, el handleGuardar solo envía `fecha_prometida` al API.

---

## Layout del formulario de OT

El formulario usa el **patrón de labels al costado** (igual que Artículos):

```typescript
const lbl  = 'w-32 shrink-0 text-right text-xs text-gray-500 leading-none pt-[9px]'
const lbl2 = 'w-32 shrink-0 text-right text-xs text-gray-500 leading-none'

// Uso:
<div className="flex items-center gap-3">
  <span className={lbl}>Fecha</span>
  <Input className="h-8 text-sm flex-1" ... />
</div>
```

- Secciones en `p-4` con `space-y-2` (compacto)
- "Datos generales" y "Receta/médico" en grid de 2 columnas
- Inputs de altura `h-7`/`h-8`
- Tabla de graduación con inputs `h-7 text-xs`

---

## Selector de lista de precios en OT

En la sección **Artículos**, aparece un selector `<select>` que carga las listas de precio de categoría `venta` activas desde `/api/dashboard/listas-precio`.

- Por defecto selecciona la que tenga "público/publica" en el nombre, o la primera disponible
- Al seleccionar un artículo desde `ArmazonSearch`, se llama a `/api/dashboard/articulos/{id}/precios?variante_id={v}` y se usa `precio_calculado ?? precio` del precio vigente que coincida con `lista_precio_id`
- Si no hay precio en la lista elegida, se cae al `precio_venta` del artículo/variante

**Flujo de props:**
```
[id]/page.tsx (listaId state)
  └─► ItemRow (listaId prop)
        └─► ArmazonSearch (listaId prop)
              └─► getPrecioLista() → fetch /api/dashboard/articulos/{id}/precios
```

---

## Impresión / Generación de PDF

### Dónde está disponible el botón Imprimir

| Lugar | Comportamiento |
|-------|----------------|
| Topbar de la OT (edición) | Botón "Imprimir" — abre `/print` en pestaña nueva |
| Lista de OTs — columna acciones | Icono `Printer` (violeta) junto al ojo y el lápiz |
| Dialog de vista rápida (`OrdenViewDialog`) | Botón "Imprimir" en el pie del dialog |
| Al crear una OT nueva y guardar | Dialog: "¿Deseas imprimir la orden?" — si confirma, abre `/print` y navega a la OT |

### Página de impresión (`[id]/print/page.tsx`)

Client component que:
1. Carga la OT via `GET /api/dashboard/optica/ordenes/{id}`
2. Genera código de barras CODE128 con **jsbarcode** (se renderiza en un `<svg>` via `useEffect`)
3. Muestra una barra de acción (Imprimir / Cerrar) oculta al imprimir con `print:hidden`
4. Llama `window.print()` desde el botón para generar PDF o imprimir

**Estructura del documento:**
```
ENCABEZADO (una fila)
├── Logo (fondo oscuro, /logos/logo blanco.png)
├── Código de barras CODE128 del número de OT
├── Separador vertical
└── Nombre cliente  /  NRO OT
    Teléfono        /  Fecha · Prometido
    Total (azul)

DATOS DEL CLIENTE Y MÉDICO (grid 2 cols)
GRADUACIÓN (tabla Lejos/Cerca × OD/OI × Esfera/Cilindro/Eje) — **siempre se imprime**, aun con valores en 0 o vacíos (los vacíos muestran "—")
ARTÍCULOS (tabla con tipo, uso, precio unitario, subtotal)
TOTALES (subtotal artículos, costo trabajo, descuento, TOTAL)
SEÑAS / PAGOS (tabla + resumen pagado / saldo)
OBSERVACIONES (si hay texto)
PIE (número OT · fecha de emisión)
```

**CSS de impresión:**
```css
@media print {
  @page { size: A4; margin: 12mm 15mm; }
  body { print-color-adjust: exact; }
}
```

### Barcode (`Barcode` component en print/page.tsx)

```tsx
function Barcode({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (svgRef.current && value) {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128', width: 2, height: 48,
        displayValue: true, fontSize: 11, margin: 0, background: 'transparent',
      })
    }
  }, [value])
  return <svg ref={svgRef} />
}
```

> **jsbarcode** es CLIENT ONLY. No importar en server components ni en código que corra en SSR.

---

## Flujo de creación de una OT

```
1. Usuario completa: cliente (opcional), médico (opcional), graduación, ítems, costo_trabajo, anticipo
2. POST /api/dashboard/optica/ordenes
3. API genera número correlativo (OT-XXXXX), asigna sucursal_id desde cookie, created_by desde session
4. Retorna el id → abre dialog "¿Deseas imprimir?"
   - Sí → abre /print en nueva pestaña + navega a /dashboard/optica/ordenes/{id}
   - No → navega directamente a /dashboard/optica/ordenes/{id}
```

---

## Flujo de pagos

`POST /api/dashboard/optica/ordenes/[id]/pago`

- Inserta en `optica_orden_pagos`
- Asocia a la caja abierta de la sucursal activa (`caja_sesion_id`)
- **No** usa el campo `anticipo` del header de la OT — el anticipo es solo informativo al crear

**Saldo** = `total − sum(optica_orden_pagos.monto)` (montos negativos de anulación se suman).

### FormasPagoCobro (componente unificado de pagos)

El formulario de OT usa el componente `FormasPagoCobro` (`components/pago/FormasPagoCobro.tsx`) para el selector de métodos de pago. Este componente calcula recargo sobre el **saldo** (no sobre el total):

```
saldo = max(0, total - totalPagado)
recargo = round(saldo * pct / 100 * 100) / 100
```

- Se muestra un banner amber cuando `saldo < total` (indicando que ya hay pagos previos)
- El recargo y la cuota se recalculan dinámicamente al cambiar los pagos

---

## Anulación

`POST /api/dashboard/optica/ordenes/[id]/cambiar-estado` con `{ estado: 'anulado' }`

Si `saldo > 0.005` al momento de anular, **se genera automáticamente un pago negativo**:
```
monto    = −saldo
concepto = 'ANULACION OT OT-XXXXX'
metodo   = 'OTRO'
```
Esto balancea el saldo a cero y deja un asiento contable en `optica_orden_pagos`.

Luego el frontend recarga la OT para mostrar el nuevo pago en la tabla.

---

## Eliminación (solo Administrador)

`DELETE /api/dashboard/optica/ordenes/[id]`

- Solo accesible si `session.user.role === 'Administrador'` (403 si no)
- Solo si la OT no tiene tareas ni pagos (409 si tiene)
- Inserta en `eliminaciones_log` antes de eliminar (snapshot: número, cliente, total, fecha, sucursal, estado)
- El botón Trash2 en la lista solo se muestra a admins y solo cuando no hay tareas ni pagos

---

## Multi-sucursal y filtrado

- Las OT se filtran por `sucursal_id` según la cookie activa
- Si el admin tiene "ver todas" activado, se muestran todas las sucursales
- La sucursal activa al crear la OT queda grabada en `optica_ordenes.sucursal_id`
- Los pagos se asocian a la caja abierta de la sucursal activa al momento del pago

---

## Tipos TypeScript (`types/optica.ts`)

```typescript
type EstadoOpticaOrden = 'pendiente' | 'en_proceso' | 'en_laboratorio' | 'terminado' | 'entregado' | 'anulado'
type EstadoTarea       = 'en_proceso' | 'en_laboratorio' | 'terminada'
type TipoOpticaItem    = 'armazon' | 'cristal' | 'tratamiento' | 'otro'
type UsoItem           = 'lejos' | 'cerca' | 'ambos'
type LaboratorioTipo   = 'propio' | 'externo'
type MetodoPagoOptica  = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO'
                       | 'CUENTA_CORRIENTE' | 'CHEQUE' | 'OTRO'
```

Interfaces principales: `OpticaOrden`, `OpticaOrdenItem`, `OpticaOrdenTarea`, `OpticaOrdenPago`, `OpticaMedico`.

---

## Gotchas y notas técnicas

1. **FK ambigua en PostgREST:** `optica_orden_tareas` tiene dos FK a `users` (`usuario_id`, `created_by`). Siempre usar `users!usuario_id(name, email)` en los `.select()` de PostgREST.

2. **Select base-ui:** `onValueChange` del componente Select de base-ui retorna `string | null`. Usar siempre `onValueChange={v => setEstado(v ?? 'default')}`.

3. **Caja requerida para pagos:** Los pagos buscan la caja sesión abierta de la sucursal activa. Si no hay caja abierta, `caja_sesion_id` queda null (no falla — el pago igual se registra).

4. **getTenantClient:** Todas las rutas API usan `getTenantClient(session)` (no `supabaseAdmin` directo).

5. **Patrón server wrapper:** El page.tsx de lista es un server component que llama `auth()` y pasa `isAdmin` al `_client.tsx`.

6. **jsbarcode SSR:** `import JsBarcode from 'jsbarcode'` solo funciona en client components (`'use client'`). Si se importa en un server component el build falla porque JsBarcode accede a `document`.

7. **Selector de lista de precios:** El fetch a `/api/dashboard/articulos/{id}/precios` se hace en el momento de selección del artículo (no al buscar), por lo que hay un pequeño delay. El dropdown se cierra inmediatamente, el precio aparece al completarse el fetch. Si falla, usa `precio_venta` como fallback.

8. **Graduaciones con valor 0:** El formulario conserva y guarda el `0` como valor real (no como null):
   - `fmtGrad()` ya no borra el campo al escribir `0` (lo deja como `0.00` en esfera/cilindro y `0` en eje).
   - `gradPayload()` usa `toNumEje()` en los ejes — antes `grad.x_eje ? parseInt(...) : null` convertía el 0 a null.
   - La impresión (`[id]/print/page.tsx`) **siempre** muestra la tabla de graduación completa (Lejos/Cerca × OD/OI): se eliminó el gate `hasGraduacion()` y el `.filter(...)` de filas. Un valor 0 se imprime como `0`; un valor vacío/null se imprime como `—`.

---

*Última actualización: 2026-09-16*
