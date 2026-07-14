# CONTEXT.md — MGA Pto. Venta

> Resumen general del proyecto. Para sesiones de IA adjuntá este archivo
> más el archivo de contexto del módulo específico en que vayas a trabajar.

---

## Descripción general

Sistema de punto de venta y gestión de stock multi-sucursal para comercios.
Incluye POS, órdenes de venta, gestión de stock con variantes, caja, clientes,
notas de crédito y administración de usuarios/roles/permisos.

- **Repo:** `c:\MGA\PROYECTOSWEB\MgaPos\mga-ptoventa`
- **Deploy:** Vercel (rama `master`)

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 — App Router |
| Lenguaje | TypeScript strict |
| Estilos | Tailwind CSS v4 |
| UI components | shadcn/ui + Base UI |
| Auth | NextAuth.js v5 beta — CredentialsProvider + JWT |
| Base de datos | Supabase PostgreSQL |
| Storage | Supabase Storage (buckets: `articulos`, `sucursales`, `optica`) |
| Formularios | React Hook Form + Zod v4 |
| Notificaciones | Sonner (toast) |
| Íconos | Lucide React |
| Búsqueda | pg_trgm (fuzzy) via RPC |
| Códigos de barra | jsbarcode (CLIENT ONLY — generación de CODE128 en SVG) |

---

## Módulos implementados

| Módulo | Ruta | Estado |
|--------|------|--------|
| POS (punto de venta) | `/dashboard/ventas/pos` | ✅ |
| Ventas (historial) | `/dashboard/ventas` | ✅ |
| Órdenes de venta | `/dashboard/ventas/ordenes` | ✅ |
| Artículos (catálogo) | `/dashboard/inventario/articulos` | ✅ |
| Stock por sucursal | `/dashboard/inventario/remitos` | ✅ |
| Remitos entrada/salida | `/dashboard/inventario/remitos` | ✅ |
| Ajustes de stock | `/dashboard/inventario/remitos/ajustes` | ✅ |
| Caja | `/dashboard/caja` | ✅ |
| Clientes | `/dashboard/ventas/clientes` | ✅ |
| Proveedores | `/dashboard/inventario/proveedores` | ✅ |
| Notas de crédito | `/dashboard/ventas/notas-credito` | ✅ |
| Usuarios | `/dashboard/admin/usuarios` | ✅ |
| Roles | `/dashboard/admin/roles` | ✅ |
| Permisos | `/dashboard/admin/permisos` | ✅ |
| Sucursales | `/dashboard/admin/sucursales` | ✅ |
| **Óptica — Órdenes de trabajo** | `/dashboard/optica/ordenes` | ✅ |
| **Óptica — Servicios** | `/dashboard/optica/servicios` | ✅ |
| **Óptica — Médicos** | `/dashboard/optica/medicos` | ✅ |
| **Listados — Cta. Cte. Clientes** | `/dashboard/listados/cobranzas` | ✅ |
| **Listados — Venta de artículos** | `/dashboard/listados/ventas-articulos` | ✅ |
| **Listados — Lista de precios** | `/dashboard/listados/precios` | ✅ |
| **Listados — Movimientos de caja** | `/dashboard/listados/movimientos-caja` | ✅ |

---

## Contexto técnico por módulo

| Módulo | Archivo de contexto |
|--------|---------------------|
| Auth, roles, permisos | [context/AUTH_CONTEXT.md](AUTH_CONTEXT.md) |
| Ventas + POS | [context/modulos/ventas.md](modulos/ventas.md) |
| Órdenes de venta | [context/modulos/ordenes.md](modulos/ordenes.md) |
| Artículos + variantes | [context/modulos/articulos.md](modulos/articulos.md) |
| Stock + remitos | [context/modulos/stock.md](modulos/stock.md) |
| Caja | [context/modulos/caja.md](modulos/caja.md) |
| Notas de crédito + cobranzas | [context/modulos/notas-credito.md](modulos/notas-credito.md) |
| Clientes + proveedores | [context/modulos/clientes.md](modulos/clientes.md) |
| Administración | [context/modulos/administracion.md](modulos/administracion.md) |
| **Óptica — Órdenes de trabajo** | [context/modulos/optica-ordenes.md](modulos/optica-ordenes.md) |
| **Óptica — Servicios** | [context/modulos/optica-servicios.md](modulos/optica-servicios.md) |
| **Listados e informes** | [context/modulos/listados.md](modulos/listados.md) |
| **UI Theming — Logo y Color** | [context/modulos/ui-theming.md](modulos/ui-theming.md) |
| Schema completo de BD | [context/DATABASE.md](DATABASE.md) |

---

## Arquitectura general

```
app/
├── (dashboard)/dashboard/   # Páginas protegidas (client components)
├── api/dashboard/           # API Routes (server, usan supabaseAdmin)
├── auth/                    # Login + registro
services/
├── supabase-admin.ts        # Client con service role (solo server)
├── stock.ts                 # adjustArticuloStock, syncArticuloStock
lib/
├── auth.ts                  # Configuración NextAuth
├── sucursal.ts              # Cookie de sucursal activa
├── permisos.ts              # getModulePermisos()
types/                       # Tipos TypeScript por módulo
context/                     # Esta documentación
supabase/schema.sql          # Schema SQL completo
proxy.ts                     # Protección de rutas (reemplaza middleware.ts)
```

### Reglas de acceso a BD
- **Server (API routes):** siempre `supabaseAdmin` (service role, sin RLS)
- **Client (hooks, pages):** `supabase` (anon key) — solo para operaciones de lectura pública o con RLS

### Stock — fuente única de verdad
`articulo_stock(articulo_id, variante_id, sucursal_id, stock_actual)` es la fuente real.
`articulos.stock_actual` y `articulo_variantes.stock_actual` son **totales calculados** para display,
actualizados por `syncArticuloStock()` después de cada operación.

### Sucursal activa
Se guarda en cookie (`sucursal_id`). Se lee con `getActiveSucursalId()` o `getSucursalFilter()` desde `lib/sucursal.ts`.
Todas las operaciones de stock (ventas, órdenes) usan la sucursal activa al momento de la transacción
y la guardan en la fila (`ventas.sucursal_id`, `ordenes_venta.sucursal_id`).
La API `/api/dashboard/sucursales/selected` devuelve `{ id, nombre, logo_url, isHome, verTodas }` de la sucursal activa.

### Theming por sucursal
El campo `sucursales.color` (hex) se aplica como variable CSS `--primary` en todo el dashboard.
El campo `sucursales.logo_url` reemplaza el logo estático del sidebar.
Ver [context/modulos/ui-theming.md](modulos/ui-theming.md).

### Nombre de empresa en sesión
`session.user.empresa_nombre` — cargado desde la tabla `empresas` de la DB maestra al iniciar sesión.
Se muestra en el header en lugar de "Dashboard" en la ruta raíz.

---

## Variables de entorno requeridas

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # Solo servidor — nunca exponer al cliente
NEXTAUTH_URL=
NEXTAUTH_SECRET=
```

---

## Eliminaciones con log de auditoría

Los documentos principales (OT, ordenes de venta, ventas, remitos) solo pueden eliminarse por un **Administrador**. Cada eliminación queda registrada en la tabla `eliminaciones_log` con snapshot del documento.

| Tipo | Condición adicional |
|------|---------------------|
| `optica_ot` | Sin tareas y sin pagos |
| `optica_servicio` | Sin tareas y sin pagos |
| `orden_venta` | Estado = `borrador` |
| `venta` | Estado = `anulada` |
| `remito` | Estado en {`borrador`, `anulado`} |

Ver `supabase/migrations/20260603_eliminaciones_log.sql`.

---

**Última actualización:** 2026-07-14
