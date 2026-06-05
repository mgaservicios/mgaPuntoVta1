# AUTH_CONTEXT.md — Sistema de Auth y Permisos

Adjuntá este archivo al inicio de cualquier chat sobre autenticación, roles o permisos.

---

## Stack

- **NextAuth.js v5 beta** — CredentialsProvider + JWT
- **Supabase Auth** — email/password como backend de credenciales
- **`proxy.ts`** (no `middleware.ts`) — protección de rutas en Next.js 16+
- **`public.users`** — extiende `auth.users` con perfil y role_id

---

## Roles

| id | name | is_default | Descripción |
|----|------|------------|-------------|
| 1 | `Administrador` | false | Acceso total al sistema |
| 2 | `Supervisor` | false | Reportes, stock, clientes — sin borrar |
| 3 | `Vendedor` | true | POS, clientes, caja — sin stock ni admin |

> Solo puede existir un rol con `is_default = true` (unique partial index).
> El rol se guarda por **name** en el JWT: `session.user.role === 'Administrador'`.
> Al registrarse un usuario nuevo se asigna automáticamente el rol con `is_default = true`.

---

## Matriz de permisos por rol

| Módulo | Admin | Supervisor | Vendedor |
|--------|-------|-----------|---------|
| articulos | ✅✅✅✅ | 👁️ | 👁️ |
| ventas | ✅✅✅✅ | 👁️ | 👁️➕ |
| stock | ✅✅✅✅ | ✅✅✅ | ❌ |
| cobranzas | ✅✅✅✅ | 👁️ | ❌ |
| caja | ✅✅✅✅ | 👁️ | 👁️➕ |
| clientes | ✅✅✅✅ | ✅✅✅ | 👁️➕ |
| proveedores | ✅✅✅✅ | 👁️ | ❌ |
| admin | ✅✅✅✅ | ❌ | ❌ |

Leyenda: ✅✅✅✅ = ver/crear/editar/borrar · ✅✅✅ = ver/crear/editar · 👁️➕ = ver/crear · 👁️ = solo ver · ❌ = sin acceso

> `Administrador` tiene acceso total sin consultar `role_permissions` (shortcircuit en `getModulePermisos`).

---

## Sesión (JWT payload)

```typescript
session.user = {
  id: string       // UUID — auth.users.id
  email: string
  name: string
  role: string     // roles.name — ej: 'Administrador'
  role_id: number  // roles.id  — ej: 1
}
```

---

## Flujo de autenticación

```
1. Usuario ingresa email + password en /auth/signin
2. NextAuth CredentialsProvider llama a supabase.auth.signInWithPassword()
3. Si válido → carga public.users JOIN public.roles por UUID
4. Serializa { id, email, name, role, role_id } en el JWT
5. proxy.ts intercepta cada request:
   - /dashboard/* sin sesión → redirige a /auth/signin
   - /dashboard/admin/* sin rol Administrador → redirige a /dashboard
6. API routes validan sesión con auth() al inicio
```

---

## Verificar permisos (server-side)

```typescript
// En page.tsx (Server Component)
import { getModulePermisos } from '@/lib/permisos'
import { auth } from '@/lib/auth'

const session = await auth()
const permisos = await getModulePermisos(session.user.role_id, session.user.role, 'ventas')
if (!permisos.can_view) redirect('/dashboard')
```

## Verificar permisos (client-side)

```typescript
// En Client Component
import { usePermissions } from '@/hooks/usePermissions'

const permisos = usePermissions('ventas')
// { can_view, can_create, can_edit, can_delete }
```

---

## Rutas protegidas

| Ruta | Requiere |
|------|---------|
| `/dashboard/*` | Sesión activa |
| `/dashboard/admin/*` | `role === 'Administrador'` |
| `/api/dashboard/*` | Sesión activa (verificado en cada route handler) |
| `/auth/signin` | Sin sesión (si hay sesión → redirige a `/dashboard`) |

---

## Archivos clave

| Archivo | Responsabilidad |
|---------|----------------|
| `types/auth.ts` | Tipos TypeScript + module augmentation de NextAuth |
| `lib/auth.ts` | Configuración NextAuth + CredentialsProvider |
| `lib/supabase.ts` | Cliente Supabase anon key (client-side) |
| `services/supabase-admin.ts` | Cliente Supabase service role (server-only) |
| `lib/permisos.ts` | `getModulePermisos()` — consulta role_permissions |
| `proxy.ts` | Protección de rutas (Next.js 16 route protection) |
| `hooks/usePermissions.ts` | Hook client con cache en memoria |
| `app/auth/signin/page.tsx` | Página de login |
| `app/auth/registro/page.tsx` | Página de registro |
| `app/api/dashboard/admin/usuarios/` | CRUD de usuarios |
| `app/api/dashboard/admin/roles/` | CRUD de roles |
| `app/api/dashboard/admin/permisos/` | GET/PATCH matriz de permisos |
| `app/api/dashboard/admin/sucursales/` | CRUD de sucursales |

---

## Schema SQL relevante

```sql
-- Un solo rol default
create unique index roles_is_default_true on public.roles (is_default) where is_default = true;

-- RLS en users: cada usuario ve solo su propio perfil
-- supabaseAdmin (service_role) bypasea RLS para operaciones admin
alter table public.users enable row level security;
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_service_role_all" on public.users for all using (auth.role() = 'service_role');
```

---

*Última actualización: 2026-05-28*
