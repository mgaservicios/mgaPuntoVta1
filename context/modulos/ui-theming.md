# UI Theming — Logo y Color por Sucursal

> Sistema de personalización visual de la aplicación por sucursal.
> El color y el logo se configuran en **Admin → Sucursales → [editar sucursal]**.

---

## Resumen

Cada sucursal puede tener un **logo** propio y un **color de marca**. Estos valores
se almacenan en la tabla `sucursales` y se aplican en tiempo real al cargar el layout
del dashboard, sin necesidad de redespliegue.

---

## Base de datos

### Campos nuevos en `public.sucursales`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `logo_url` | `text` | URL pública del logo en Supabase Storage (bucket `sucursales`) |
| `color` | `text` | Color en formato hexadecimal `#RRGGBB`. Ej: `#1e3a8a`, `#166534` |

Migración: `supabase/migrations/20260609_sucursales_logo_color.sql`

```sql
ALTER TABLE sucursales
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS color    text;
```

---

## Carga del logo

### Upload API
`POST /api/dashboard/admin/sucursales/upload-logo`

- Solo accesible para rol **Administrador**
- Formatos aceptados: `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`
- Almacena en bucket Supabase Storage `sucursales` (creado automáticamente si no existe, público)
- Devuelve `{ url: string }` con la URL pública

### Formulario de sucursal
`app/(dashboard)/dashboard/admin/sucursales/[id]/page.tsx`

- **Logo**: área de carga con `<input type="file">` oculto. Muestra preview sobre fondo oscuro
  (para visualizar logos claros). Botones "Cambiar logo" y "Quitar logo".
- **Color**: `<input type="color">` (selector nativo del OS) + campo texto hex + vista previa
  en tiempo real con el color aplicado.
- Ambos valores se envían al API como `logo_url` y `color` en el body JSON del PUT/POST.

---

## Propagación al layout

### Flujo de datos (server-side)

```
layout.tsx (Server Component)
  └─ getSucursales() → SELECT id, nombre, direccion, activo, logo_url, color
  └─ activeSucursal = sucursales.find(s => s.id === activeSucursalId ?? homeCookieVal)
  └─ sidebarLogoUrl = activeSucursal?.logo_url ?? null
  └─ sidebarColor   = activeSucursal?.color ?? null
  └─ brandColor     = validar hex (/^#[0-9A-Fa-f]{6}$/) — protección XSS
```

> Si el admin está en modo "Todas las sucursales" (`verTodas`), se usa la sucursal de login (`homeCookieVal`).

---

## Aplicación del color de marca

### CSS variables globales (`layout.tsx`)

Si `brandColor` es un hex válido, se inyecta un `<style>` tag que sobreescribe las
variables CSS de shadcn/ui:

```tsx
<style>{`
  :root {
    --primary: ${brandColor};
    --primary-foreground: ${brandFg};  /* #ffffff o #000000 según luminancia */
    --ring: ${brandColor};
  }
`}</style>
```

Esto hace que **todos** los elementos shadcn que usen `bg-primary`, `text-primary`,
`ring`, `outline-ring` adopten automáticamente el color de la sucursal:
- Botones primarios (`Button` variant default)
- Badges
- Focus rings en inputs

**Detección de luminancia** — `isLightColor(hex)`:
```typescript
(0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
```
Si el color es claro → `--primary-foreground: #000000` (texto oscuro sobre botón claro).
Si el color es oscuro → `--primary-foreground: #ffffff`.

### Sidebar (`components/dashboard/Sidebar.tsx`)

| Elemento | Implementación |
|----------|---------------|
| Fondo de la barra | `style={{ backgroundColor: color \|\| '#0D1525' }}` (inline style) |
| Item activo del menú | `bg-white/20 text-white shadow-sm` (overlay blanco semitransparente) |
| Item inactivo hover | `hover:bg-white/8 hover:text-white` |

El overlay blanco (`bg-white/20`) funciona sobre cualquier color de fondo sin necesitar
cálculos de contraste adicionales.

### Barra de acciones rápidas (`QuickActionsBar` en `Header.tsx`)

- Recibe `color?: string | null` desde el layout
- Item activo: `backgroundColor: hexToRgba(color, 0.10)` + `color: brand` (tinte del color de marca al 10%)
- Item inactivo: `text-gray-600 hover:bg-gray-100`

```typescript
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
```

---

## Logo en el sidebar

Cuando `logoUrl` está seteado, se muestra en un **círculo con fondo blanco**:

```tsx
<div className="w-24 h-24 rounded-full bg-white shadow-sm flex items-center justify-center overflow-hidden p-2">
  <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
</div>
```

Cuando no hay logo subido → fallback al logo estático `public/logos/logo blanco.png`.

---

## Nombre de empresa en el header

El nombre de la empresa (tabla `empresas` de la DB maestra) se guarda en el JWT de
sesión como `empresa_nombre` y se muestra en el header en lugar de la palabra "Dashboard"
cuando el usuario está en la pantalla principal `/dashboard`.

### Flujo
1. Login → `lib/auth.ts` → `empresa.nombre` → guardado en JWT como `token.empresa_nombre`
2. Session callback → `session.user.empresa_nombre`
3. `layout.tsx` → `empresaNombre={session.user.empresa_nombre}` → `DashboardHeader`
4. `Header.tsx` → `displayTitle = title === 'Dashboard' ? empresaNombre : title`

> El nombre se carga al iniciar sesión. Si cambia en la DB maestra, el usuario debe cerrar
> y volver a iniciar sesión para verlo actualizado.

---

## Barra de acciones rápidas — comportamiento

Declarada en `components/dashboard/Header.tsx` como export nombrado `QuickActionsBar`.
Se renderiza en el layout entre el header y el `<main>`, por lo que es **persistente en todas las páginas**.

### Acciones disponibles (filtradas por módulo activo)

| Acción | Ruta | Módulo |
|--------|------|--------|
| Punto de Venta | `/dashboard/ventas/pos` | `ventas` |
| Nueva OT | `/dashboard/optica/ordenes/nueva` | `optica` |
| Nuevo remito | `/dashboard/inventario/remitos/nuevo` | `inventario` |
| Nuevo servicio | `/dashboard/optica/servicios/nueva` | `optica` |
| Stock y precios | `/dashboard/consultas/stock` | `inventario` |
| Artículos | `/dashboard/inventario/articulos` | `inventario` |

Solo se muestran las acciones cuyo módulo esté en `session.user.modules`.

---

## Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `supabase/migrations/20260609_sucursales_logo_color.sql` | Migración DB |
| `app/api/dashboard/admin/sucursales/upload-logo/route.ts` | API upload |
| `app/api/dashboard/admin/sucursales/route.ts` | GET/POST sucursales (incluye logo_url, color) |
| `app/api/dashboard/admin/sucursales/[id]/route.ts` | GET/PUT sucursal (incluye logo_url, color) |
| `app/(dashboard)/dashboard/admin/sucursales/[id]/page.tsx` | Formulario con color picker y logo upload |
| `app/(dashboard)/dashboard/layout.tsx` | Inyecta CSS vars, pasa logo/color a Sidebar |
| `components/dashboard/Sidebar.tsx` | Usa logo y color dinámicos |
| `components/dashboard/Header.tsx` | QuickActionsBar con color dinámico; nombre de empresa |
| `types/sucursales.ts` | Tipo `Sucursal` con `logo_url` y `color` |
| `types/auth.ts` | Session/JWT con `empresa_nombre` |
| `lib/auth.ts` | Propaga `empresa_nombre` al JWT y sesión |

---

*Última actualización: 2026-06-09*
