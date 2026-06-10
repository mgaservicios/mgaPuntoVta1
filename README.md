# MGA Pto. Venta

Sistema de punto de venta y gestión para comercio/óptica. Next.js App Router + Supabase multi-tenant.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript strict |
| Estilos | Tailwind CSS v4 |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | NextAuth v5 beta + Supabase Auth |
| Formularios | React Hook Form + Zod v4 |
| Componentes UI | shadcn/ui sobre **@base-ui/react** (no Radix) |
| Notificaciones | Sonner |
| Íconos | Lucide React |
| Barcodes | jsbarcode (CODE128, client-only) |
| IA | Groq SDK |

---

## Iniciar en desarrollo

```bash
npm install
npm run dev
```

La app corre en `http://localhost:3000`.

Variables de entorno necesarias (`.env.local`):

```
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Por tenant — el cliente se construye en runtime según la sesión
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Arquitectura

### Multi-tenant

Cada empresa tiene su propia instancia de Supabase. Todas las API routes construyen el cliente llamando `getTenantClient(session)` — nunca usar el cliente global directamente.

### Patrón de páginas (server + client)

Las páginas de lista que necesitan `isAdmin` siguen este patrón:

```
page.tsx          ← Server Component: obtiene sesión, pasa isAdmin como prop
_client.tsx       ← Client Component: toda la lógica UI, fetches, estado
```

### Stock

La fuente de verdad es la tabla `articulo_stock`. Nunca escribir directamente a `articulos.stock_actual` — los triggers de la base de datos lo mantienen sincronizado.

### Eliminaciones

Solo el rol Administrador puede eliminar OT, ventas, órdenes y remitos. Todas las eliminaciones se registran en `eliminaciones_log`.

### Selector de lista de precios

POS, órdenes de venta y órdenes de trabajo óptica cargan listas con `categoria='venta'` activas. Al agregar un artículo se hace fetch a `/api/dashboard/articulos/{id}/precios` para obtener el precio de la lista seleccionada. Las funciones `addToCart` / `addItem` son **async**.

### jsbarcode

Solo importar en componentes `'use client'`. Nunca en server components — accede a `document` y falla en build/SSR.

---

## Módulos

### Ventas

| Sub-módulo | Ruta | Descripción |
|-----------|------|-------------|
| POS | `/dashboard/ventas/pos` | Punto de venta: búsqueda de artículos, carrito, múltiples métodos de pago, selector de lista de precios |
| Historial | `/dashboard/ventas` | Grilla de ventas con filtros por estado/fecha, anulación, impresión |
| Detalle de venta | `/dashboard/ventas/[id]` | Items, pagos, totales, opción de anular |
| Impresión venta | `/dashboard/ventas/[id]/print` | Ticket 80mm / A4 con selector de formato |
| Órdenes de venta | `/dashboard/ventas/ordenes` | Listado con saldo pendiente, pago rápido, filtros |
| Nueva orden | `/dashboard/ventas/ordenes/nueva` | Formulario completo con condición de pago y vencimiento |
| Detalle de orden | `/dashboard/ventas/ordenes/[id]` | Items, pagos, estado, confirmar/anular |
| Impresión orden | `/dashboard/ventas/ordenes/[id]/print` | Ticket 80mm / A4 con selector de formato |
| Clientes | `/dashboard/ventas/clientes` | ABM de clientes |
| Notas de crédito | `/dashboard/ventas/notas-credito` | Emisión y consulta de NC |

**Impresión de ventas y órdenes:**
- Selector de formato en la barra de acción (visible solo en pantalla): **Ticket 80 mm** o **A4**
- El CSS `@page` se inyecta dinámicamente según el formato elegido
- Todas las impresiones incluyen logo, código de barras CODE128, número de comprobante y leyenda *"Comprobante sin validez fiscal"*
- El POS abre un diálogo post-venta preguntando si imprimir; abre la página de impresión en nueva pestaña
- Cuando no hay cliente asignado se muestra **Consumidor final**

### Inventario

| Sub-módulo | Ruta | Descripción |
|-----------|------|-------------|
| Artículos | `/dashboard/inventario/articulos` | ABM con variantes, atributos, imágenes y precios por lista |
| Remitos | `/dashboard/inventario/remitos` | Entradas de stock: borrador → confirmado |
| Ajustes de stock | `/dashboard/inventario/remitos/ajustes` | Ajuste manual positivo/negativo |
| Proveedores | `/dashboard/inventario/proveedores` | ABM de proveedores |

### Óptica

| Sub-módulo | Ruta | Descripción |
|-----------|------|-------------|
| Órdenes de trabajo | `/dashboard/optica/ordenes` | OT con graduación, armazón, lentes, materiales, tareas y pagos |
| Médicos | `/dashboard/optica/medicos` | ABM de médicos derivantes |
| Impresión OT | `/dashboard/optica/ordenes/[id]/print` | A4 con barcode, logo, graduación y receta |

### Consultas

| Sub-módulo | Ruta | Descripción |
|-----------|------|-------------|
| Stock | `/dashboard/consultas/stock` | Stock por artículo y sucursal |
| Precios y costos | `/dashboard/consultas/precios-costo` | Comparativa de precios y márgenes |
| Seguimiento | `/dashboard/consultas/seguimiento` | Trazabilidad de movimientos |

### Caja

Ruta: `/dashboard/caja` — apertura y cierre de sesión de caja, movimientos, resumen por método de pago.

### Administración

| Sub-módulo | Ruta |
|-----------|------|
| Usuarios | `/dashboard/admin/usuarios` |
| Roles | `/dashboard/admin/roles` |
| Permisos | `/dashboard/admin/permisos` |
| Sucursales | `/dashboard/admin/sucursales` |
| Listas de precio | `/dashboard/admin/listas-precio` |

---

## API Routes

Todas bajo `/api/dashboard/`. Siguen el patrón REST:

```
GET    /api/dashboard/ventas           → lista con filtros
POST   /api/dashboard/ventas           → crear
GET    /api/dashboard/ventas/[id]      → detalle
POST   /api/dashboard/ventas/[id]/anular
```

Recursos disponibles: `ventas`, `ordenes`, `notas-credito`, `articulos`, `stock/remitos`, `stock/ajustes`, `clientes`, `proveedores`, `caja/sesion`, `optica/ordenes`, `optica/medicos`, `listas-precio`, `categorias`, `subcategorias`, `marcas`, `atributo-tipos`, `sucursales`, `admin/usuarios`, `admin/roles`, `admin/permisos`.

---

## Esquema de base de datos

Archivo completo: [`supabase/schema.sql`](supabase/schema.sql)  
Migraciones incrementales: [`supabase/migrations/`](supabase/migrations/)

Tablas principales:

| Tabla | Descripción |
|-------|-------------|
| `users` | Usuarios del sistema (vinculados a `auth.users`) |
| `roles` / `role_permissions` | Control de acceso por módulo |
| `sucursales` | Branches del negocio |
| `articulos` / `articulo_variantes` | Catálogo de productos |
| `articulo_stock` | Stock por artículo/variante/sucursal (fuente de verdad) |
| `listas_precio` / `lista_precio_items` | Listas de precios de venta |
| `ventas` / `venta_items` / `venta_pagos` | Transacciones POS |
| `ordenes_venta` / `orden_venta_items` / `orden_venta_pagos` | Presupuestos y ventas a crédito |
| `notas_credito` | NC vinculadas a ventas o emitidas manualmente |
| `stock_remitos` / `stock_remito_items` | Ingresos de mercadería |
| `caja_sesiones` / `caja_movimientos` | Control de caja |
| `optica_ordenes` / `optica_orden_tareas` | Órdenes de trabajo óptica |
| `optica_medicos` | Médicos derivantes |
| `clientes` / `proveedores` | Terceros |
| `eliminaciones_log` | Auditoría de borrados |

---

## Tipos TypeScript

Definidos en [`types/`](types/):

- `articulos.ts` — Articulo, Variante, Stock
- `ventas.ts` — Venta, VentaItem, VentaPago, MetodoPago
- `ordenes.ts` — OrdenVenta, OrdenVentaItem, OrdenVentaPago, CondicionPago, CONDICION_LABELS
- `notas-credito.ts` — NotaCredito
- `optica.ts` — OpticaOrden, Graduacion, Tarea
- `precios.ts` — ListaPrecio, ListaPrecioItem
- `stock.ts` — Remito, RemitoItem
- `clientes.ts` — Cliente
- `proveedores.ts` — Proveedor
- `sucursales.ts` — Sucursal
- `auth.ts` — Session, UserSession

---

## Comandos útiles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run lint     # ESLint
npx tsc --noEmit # Chequeo de tipos sin compilar
```
#   m g a _ p o s _ v 1  
 #   m g a _ p o s _ v 1  
 