# Spec: Módulo Superadmin — Gestión de Empresas (Tenants)

## Contexto

Esta app (MGA interna) actúa como **panel de control** para el sistema de punto de venta `mga-ptoventa`. Cada comercio que usa ese sistema es un "tenant" con su propia base de datos Supabase. Esta app gestiona los tenants: sus credenciales de conexión, los módulos habilitados y los datos comerciales del cliente.

El proyecto `mga-ptoventa` lee la tabla `empresas` de **esta BD** para:
1. Resolver el login del usuario (busca la empresa por `codigo`)
2. Conectarse a la BD del tenant (`supabase_url` + keys)
3. Saber qué módulos tiene habilitados (`empresa_modulos`)

---

## 1. Base de datos — ejecutar en Supabase

```sql
create table public.empresas (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  codigo                text unique not null,          -- código de acceso del tenant (ej: "FARMACIA2025")
  activo                boolean default true,
  supabase_url          text not null,                 -- URL del proyecto Supabase del tenant
  supabase_anon_key     text not null,                 -- anon key del tenant
  supabase_service_key  text not null,                 -- service role key del tenant
  -- Datos comerciales
  razon_social          text,
  cuit                  text,
  telefono              text,
  email                 text,
  direccion             text,
  localidad             text,
  plan                  text default 'basico',          -- basico | profesional | enterprise
  fecha_inicio          date,
  fecha_vencimiento     date,
  -- Seguimiento de implementación
  estado_implementacion text default 'en_progreso',    -- en_progreso | activo | pausado | suspendido
  notas                 text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create table public.empresa_modulos (
  empresa_id  uuid    not null references public.empresas(id) on delete cascade,
  modulo      text    not null,
  activo      boolean default true,
  primary key (empresa_id, modulo)
);
```

**Módulos válidos:** `ventas`, `inventario`, `caja`, `contactos`, `finanzas`, `administracion`

---

## 2. Autenticación del panel

El acceso al panel es con una **contraseña única** almacenada en variable de entorno. No usa NextAuth ni Supabase Auth — es una cookie HttpOnly simple.

### Variable de entorno
```
SUPERADMIN_SECRET=tu-clave-secreta-aqui
```

### `lib/superadmin-auth.ts`

```typescript
import { cookies } from 'next/headers'

const SECRET = process.env.SUPERADMIN_SECRET ?? 'change-me-in-env'
const COOKIE = 'sa_session'

export async function isSuperadminAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return store.get(COOKIE)?.value === SECRET
}

export function setSuperadminCookie(res: Response): Response {
  res.headers.set(
    'Set-Cookie',
    `${COOKIE}=${SECRET}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`
  )
  return res
}

export function clearSuperadminCookie(res: Response): Response {
  res.headers.set(
    'Set-Cookie',
    `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
  )
  return res
}
```

---

## 3. Cliente Supabase

Para las API routes del superadmin se necesita un cliente con service role (acceso total):

```typescript
// services/supabase-master.ts
import { createClient } from '@supabase/supabase-js'

export const supabaseMaster = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)
```

---

## 4. API Routes

### `app/api/superadmin/auth/route.ts`
Login y logout.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { setSuperadminCookie, clearSuperadminCookie } from '@/lib/superadmin-auth'

const SECRET = process.env.SUPERADMIN_SECRET ?? 'change-me-in-env'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password !== SECRET) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  return setSuperadminCookie(res as unknown as Response) as unknown as NextResponse
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  return clearSuperadminCookie(res as unknown as Response) as unknown as NextResponse
}
```

### `app/api/superadmin/empresas/route.ts`
Listar y crear empresas.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { isSuperadminAuthenticated } from '@/lib/superadmin-auth'
import { supabaseMaster } from '@/services/supabase-master'

const MODULOS_DEFAULT = ['ventas', 'inventario', 'caja', 'contactos', 'finanzas', 'administracion']

export async function GET() {
  if (!await isSuperadminAuthenticated())
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabaseMaster
    .from('empresas')
    .select('*, empresa_modulos(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!await isSuperadminAuthenticated())
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const {
    nombre, codigo, supabase_url, supabase_anon_key, supabase_service_key,
    razon_social, cuit, telefono, email, direccion, localidad,
    plan, fecha_inicio, fecha_vencimiento, estado_implementacion, notas,
    modulos, // string[] — módulos a activar, por defecto todos
  } = body

  if (!nombre?.trim() || !codigo?.trim() || !supabase_url?.trim())
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })

  const { data: empresa, error } = await supabaseMaster
    .from('empresas')
    .insert({
      nombre: nombre.trim(),
      codigo: codigo.trim().toUpperCase(),
      supabase_url: supabase_url.trim(),
      supabase_anon_key: supabase_anon_key.trim(),
      supabase_service_key: supabase_service_key.trim(),
      razon_social, cuit, telefono, email, direccion, localidad,
      plan, fecha_inicio, fecha_vencimiento, estado_implementacion, notas,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Crear registros de módulos
  const modulosActivos = (modulos ?? MODULOS_DEFAULT) as string[]
  await supabaseMaster.from('empresa_modulos').insert(
    MODULOS_DEFAULT.map(m => ({
      empresa_id: empresa.id,
      modulo: m,
      activo: modulosActivos.includes(m),
    }))
  )

  return NextResponse.json(empresa, { status: 201 })
}
```

### `app/api/superadmin/empresas/[id]/route.ts`
Ver y editar empresa.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { isSuperadminAuthenticated } from '@/lib/superadmin-auth'
import { supabaseMaster } from '@/services/supabase-master'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!await isSuperadminAuthenticated())
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabaseMaster
    .from('empresas')
    .select('*, empresa_modulos(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!await isSuperadminAuthenticated())
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const {
    nombre, codigo, activo,
    supabase_url, supabase_anon_key, supabase_service_key,
    razon_social, cuit, telefono, email, direccion, localidad,
    plan, fecha_inicio, fecha_vencimiento, estado_implementacion, notas,
  } = body

  const { data, error } = await supabaseMaster
    .from('empresas')
    .update({
      nombre, codigo: codigo?.toUpperCase(), activo,
      supabase_url, supabase_anon_key, supabase_service_key,
      razon_social, cuit, telefono, email, direccion, localidad,
      plan, fecha_inicio, fecha_vencimiento, estado_implementacion, notas,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### `app/api/superadmin/empresas/[id]/modulos/route.ts`
Actualizar módulos activos.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { isSuperadminAuthenticated } from '@/lib/superadmin-auth'
import { supabaseMaster } from '@/services/supabase-master'

type Ctx = { params: Promise<{ id: string }> }

const MODULOS_VALIDOS = ['ventas', 'inventario', 'caja', 'contactos', 'finanzas', 'administracion']

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!await isSuperadminAuthenticated())
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { modulos } = await req.json() // string[] de módulos activos

  const upserts = MODULOS_VALIDOS.map(m => ({
    empresa_id: id,
    modulo: m,
    activo: (modulos as string[]).includes(m),
  }))

  const { error } = await supabaseMaster
    .from('empresa_modulos')
    .upsert(upserts, { onConflict: 'empresa_id,modulo' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

---

## 5. Páginas UI

### Estructura de rutas sugerida
```
app/
  (superadmin)/
    layout.tsx                      ← layout vacío, solo renderiza children
    superadmin/
      page.tsx                      ← redirect a /superadmin/empresas
      login/
        page.tsx                    ← formulario de contraseña
      empresas/
        page.tsx                    ← grilla de empresas
        nueva/
          page.tsx                  ← formulario nueva empresa
        [id]/
          page.tsx                  ← editar empresa + módulos
```

### `app/(superadmin)/layout.tsx`
```tsx
export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

### `app/(superadmin)/superadmin/page.tsx`
```tsx
import { redirect } from 'next/navigation'
export default function SuperadminRoot() {
  redirect('/superadmin/empresas')
}
```

### `app/(superadmin)/superadmin/login/page.tsx`
Formulario con un campo de contraseña. Al enviar hace POST a `/api/superadmin/auth`. Si OK, redirige a `/superadmin/empresas`.

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SuperadminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/superadmin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push('/superadmin/empresas')
    } else {
      setError('Contraseña incorrecta')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-80 space-y-4">
        <h1 className="text-xl font-semibold">Panel MGA</h1>
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="w-full bg-black text-white rounded py-2">
          Ingresar
        </button>
      </form>
    </div>
  )
}
```

### `app/(superadmin)/superadmin/empresas/page.tsx`
Tabla con todas las empresas. Columnas sugeridas: Nombre, Código, Plan, Estado implementación, Módulos activos, Fecha vencimiento, Activo, acciones (Editar).

Fetches GET `/api/superadmin/empresas` al montar.

Cada fila muestra:
- Nombre + código (`FARMACIA2025`)
- Plan (`basico` / `profesional` / `enterprise`)
- Estado implementación con badge de color
- Cantidad de módulos activos
- Fecha de vencimiento
- Botón "Editar" → `/superadmin/empresas/[id]`

Botón "Nueva empresa" → `/superadmin/empresas/nueva`

### `app/(superadmin)/superadmin/empresas/nueva/page.tsx`
Formulario para crear empresa. Campos agrupados en secciones:

**Sección "Acceso"** (obligatorios para que mga-ptoventa funcione):
- `nombre` (texto, requerido)
- `codigo` (texto, requerido, se convierte a mayúsculas — es el código que el usuario escribe al hacer login en mga-ptoventa)
- `supabase_url` (URL del proyecto Supabase del comercio)
- `supabase_anon_key` (anon key)
- `supabase_service_key` (service role key)

**Sección "Datos comerciales"** (opcionales):
- `razon_social`, `cuit`, `telefono`, `email`, `direccion`, `localidad`
- `plan` (select: basico / profesional / enterprise)
- `fecha_inicio`, `fecha_vencimiento` (date inputs)

**Sección "Implementación"**:
- `estado_implementacion` (select: en_progreso / activo / pausado / suspendido)
- `notas` (textarea)

**Sección "Módulos"**:
- 6 checkboxes: ventas, inventario, caja, contactos, finanzas, administracion
- Por defecto todos activados

Al guardar: POST `/api/superadmin/empresas` → si ok → redirect a `/superadmin/empresas`

### `app/(superadmin)/superadmin/empresas/[id]/page.tsx`
Igual que el formulario de nueva empresa pero:
- Carga datos con GET `/api/superadmin/empresas/[id]` al montar
- El campo `codigo` debe ser editable
- Guardar datos: PUT `/api/superadmin/empresas/[id]`
- Guardar módulos (si cambiaron): PUT `/api/superadmin/empresas/[id]/modulos` con `{ modulos: string[] }`
- Los dos PUT pueden ir en secuencia al mismo submit

---

## 6. Protección de rutas (middleware)

Si se quiere proteger las rutas `/superadmin/*` en el middleware para que redirijan a `/superadmin/login` cuando no hay cookie:

```typescript
// En middleware.ts, agregar lógica:
if (pathname.startsWith('/superadmin') && pathname !== '/superadmin/login') {
  const cookie = request.cookies.get('sa_session')
  const secret = process.env.SUPERADMIN_SECRET ?? 'change-me-in-env'
  if (cookie?.value !== secret) {
    return NextResponse.redirect(new URL('/superadmin/login', request.url))
  }
}
```

---

## 7. Variables de entorno necesarias

```
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto-mga>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPERADMIN_SECRET=tu-clave-secreta-aqui
```

---

## 8. Notas de integración con mga-ptoventa

`mga-ptoventa` ya tiene el código para leer estas tablas. Los únicos requisitos son:

1. Las tablas `empresas` y `empresa_modulos` deben existir con las columnas descritas en la sección 1.
2. `mga-ptoventa` usa estas columnas específicas de `empresas`: `id`, `codigo`, `activo`, `supabase_url`, `supabase_anon_key`, `supabase_service_key`.
3. `mga-ptoventa` usa `empresa_modulos` con columnas: `empresa_id`, `modulo`, `activo`.
4. Los campos extra (`razon_social`, `notas`, etc.) son ignorados por `mga-ptoventa` — son solo para uso interno en esta app.

El código de `mga-ptoventa` está en `lib/auth.ts` y `services/supabase-tenant.ts` — no requiere ningún cambio.
