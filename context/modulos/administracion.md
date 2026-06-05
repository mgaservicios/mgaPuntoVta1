# administracion.md — Administración del sistema

Solo accesible para rol `Administrador`. Adjuntá también `AUTH_CONTEXT.md`.

---

## Archivos del módulo

| Archivo | Descripción |
|---------|-------------|
| `app/(dashboard)/dashboard/admin/usuarios/page.tsx` | Lista de usuarios |
| `app/(dashboard)/dashboard/admin/usuarios/[id]/page.tsx` | Editar usuario |
| `app/api/dashboard/admin/usuarios/route.ts` | GET + POST |
| `app/api/dashboard/admin/usuarios/[id]/route.ts` | GET + PUT + DELETE |
| `app/(dashboard)/dashboard/admin/roles/page.tsx` | Lista de roles |
| `app/(dashboard)/dashboard/admin/roles/nuevo/page.tsx` | Crear rol |
| `app/api/dashboard/admin/roles/route.ts` | GET + POST |
| `app/api/dashboard/admin/roles/[id]/route.ts` | GET + PUT + DELETE |
| `app/api/dashboard/admin/roles-list/route.ts` | GET lista simple para dropdowns |
| `app/(dashboard)/dashboard/admin/permisos/page.tsx` | Matriz de permisos |
| `app/api/dashboard/admin/permisos/route.ts` | GET + PATCH |
| `app/(dashboard)/dashboard/admin/sucursales/page.tsx` | Lista de sucursales |
| `app/(dashboard)/dashboard/admin/sucursales/nuevo/page.tsx` | Crear sucursal |
| `app/api/dashboard/admin/sucursales/route.ts` | GET + POST + PUT + DELETE |

---

## Usuarios

- CRUD completo. Al crear: se crea en `auth.users` (Supabase Auth) + se inserta en `public.users`.
- Al eliminar: se elimina de `auth.users` en cascade → también de `public.users`.
- Un usuario tiene un único rol. El rol se asigna al crear y se puede cambiar editando.
- Solo un Administrador puede cambiar el rol de otro usuario.

---

## Roles

- Roles dinámicos — se pueden crear desde el panel.
- Solo puede existir un rol con `is_default = true`.
- El rol default se asigna automáticamente al registrarse.
- El `name` del rol viaja en el JWT como `session.user.role`.

---

## Permisos

La pantalla muestra una matriz: filas = módulos, columnas = roles, celdas = {ver, crear, editar, borrar}.

Los módulos disponibles son:
`articulos`, `ventas`, `stock`, `cobranzas`, `caja`, `clientes`, `proveedores`, `admin`

`PATCH /api/dashboard/admin/permisos` guarda los cambios con upsert.

`Administrador` tiene acceso total independientemente de la tabla (shortcircuit en `lib/permisos.ts`).

---

## Sucursales

- CRUD de sucursales del negocio.
- Cada usuario puede tener acceso a múltiples sucursales (`user_sucursales`).
- El usuario cambia su sucursal activa con `POST /api/dashboard/sucursales/switch` → guarda en cookie.
- La sucursal activa se lee con `getActiveSucursalId()` en `lib/sucursal.ts`.

---

## Protección de rutas admin

El archivo `proxy.ts` verifica `session.user.role === 'Administrador'` para todas las rutas `/dashboard/admin/*`.
Las API routes bajo `/api/dashboard/admin/*` verifican la sesión con `auth()` individualmente.

---

*Última actualización: 2026-05-28*
