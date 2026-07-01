# 📊 ANÁLISIS COMPLETO — MGA POS

> Análisis exhaustivo de arquitectura, mejoras y plan de implementación priorizado.
> 
> **Generado:** 2026-06-18  
> **Evaluación:** Next.js 16 + Supabase multi-tenant

---

## 📋 TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Estado de Archivos Críticos](#estado-de-archivos-críticos)
3. [Evaluación de Arquitectura](#evaluación-de-arquitectura)
4. [Skills a Crear](#skills-a-crear)
5. [MCPs Útiles](#mcps-útiles)
6. [Plugins VS Code](#plugins-vs-code)
7. [Hooks Faltantes](#hooks-faltantes)
8. [Mejoras de Estructura](#mejoras-de-estructura)
9. [Plan Priorizado](#plan-priorizado)

---

## 🎯 RESUMEN EJECUTIVO

| Aspecto | Evaluación | Estado |
|--------|-----------|--------|
| **Arquitectura** | ⭐⭐⭐⭐ Excelente | Bien diseñada |
| **Compilación** | ⚠️ 8 errores TS | Bloqueante |
| **Documentación** | ⭐⭐ Media | CLAUDE.md incompleto |
| **Testing** | ❌ Cero | Crítico agregarlo |
| **DX (Developer Experience)** | ⭐⭐⭐ Media | Pueden mejorarse |
| **Estabilidad** | ⭐⭐⭐⭐ Buena | Multi-tenant funcional |

**Conclusión:** Proyecto sólido con buena arquitectura, pero necesita estabilización (resolver errores) y documentación. Testing crítico.

---

## ✅ ESTADO DE ARCHIVOS CRÍTICOS

### 1️⃣ CLAUDE.md — ⚠️ INCOMPLETO

**Estado actual:**
```markdown
@AGENTS.md
```

**Debería incluir:**
- ✅ Descripción general del proyecto
- ✅ Stack tecnológico
- ✅ Guía de setup local
- ✅ Convenciones de código
- ✅ Instrucciones para agregar features
- ✅ Links a archivos de contexto
- ✅ Glosario de términos

**Impacto:** Sin CLAUDE.md completo, la IA genera respuestas menos precisas.

---

### 2️⃣ AGENTS.md — MÍNIMO

**Estado actual:** Solo contiene aviso sobre Next.js 16 breaking changes.

**Debería agregar:**
- Instrucciones para crear custom agents
- Patrones para autenticación
- Patterns para multi-tenant

---

### 3️⃣ Errores TypeScript — 🔴 CRÍTICO

**8 errores bloquean compilación:**

| Archivo | Línea | Error | Severidad |
|---------|-------|-------|-----------|
| `usuarios/[id]/route.ts` | 37, 45, 49, 51 | `Cannot find name 'supabase'` | ALTO |
| `articulos/.../stock-sucursales/route.ts` | 43 | Type mismatch `nombre` | MEDIO |
| `articulos/route.ts` | 64, 128 | Type conversion errors | MEDIO |
| `articulos/seguimiento/route.ts` | 140, 184 | Type mismatches | MEDIO |

**Acción:** Revisar imports y type assertions.

---

## 🏗️ EVALUACIÓN DE ARQUITECTURA

### ✅ FORTALEZAS

#### 1. **Multi-tenancy bien implementada**
- Arquitectura JWT con empresa_codigo
- getTenantAdminClient() para queries por tenant
- Supabase master DB para empresas
- Cada tenant con su propia base de datos

```typescript
// Patrón correcto implementado
const tenantAdmin = await getTenantAdminClient(empresa.id)
const { data: profile } = await tenantAdmin
  .from('users')
  .select('*')
```

#### 2. **Sistema de permisos granular**
- Matriz de permisos: Administrador / Supervisor / Vendedor
- Role-based access control (RBAC)
- Permission matrix por módulo (view/create/edit/delete)
- Validación en servidor + cookie de sucursal

```typescript
// 13 módulos con control fino
articulos, ventas, stock, cobranzas, caja, clientes, 
proveedores, admin, optica-ordenes, optica-servicios
```

#### 3. **App Router correctamente usado**
- Group routes: `(dashboard)`, `(print)`, `(superadmin)`
- Separación lógica de concerns
- Layouts compartidos eficientemente
- proxy.ts para protección de rutas (mejor que middleware en Next 16)

#### 4. **TypeScript strict + Zod**
- `strict: true` en tsconfig
- Validación runtime con Zod
- Buenos type definitions en `/types`

#### 5. **Stack moderno**
- Next.js 16 (actual)
- React 19 (experimental features)
- Tailwind v4 (CSS engine nuevo)
- NextAuth v5 beta con CredentialsProvider

---

### ⚠️ DEBILIDADES & ISSUES

#### 1. **Errores de compilación TS** 🔴
- 8 errores sin resolver
- Algunos son type assertions incorrectos
- Bloquean CI/CD

#### 2. **Documentación fragmentada**
- CLAUDE.md solo referencia
- Contexto files dispersos pero existen
- Falta guía de onboarding

#### 3. **Sin testing**
- ❌ 0% test coverage
- Sin jest/vitest
- Crítico en lógica de permisos y ventas

#### 4. **Error handling inconsistente**
```typescript
// Patrón A
try {
  const data = await db.query()
} catch (error) {
  console.error(error)
}

// Patrón B
try {
  // ...
} catch (error: any) {
  return NextResponse.json({ error: error.message }, { status: 500 })
}
```

#### 5. **API routes sin middleware**
- No hay validación consistente de sesión
- Diferentes patrones para auth/permisos
- Falta `withAuth()`, `withPermission()` helpers

#### 6. **Falta de observabilidad**
- Sin logging estructurado
- Sin error tracking (Sentry)
- Sin metrics/monitoring

---

### 🎯 RECOMENDACIONES ARQUITECTURA

#### Tier 1: CRÍTICO
```
1. Resolver 8 errores TS
2. Crear lib/api-utils.ts con middleware
3. Centralizar Zod schemas
4. Implementar testing
```

#### Tier 2: IMPORTANTE
```
5. Error handling consistente
6. Logging estructurado
7. Rate limiting
8. JSDoc en API routes
```

#### Tier 3: NICE-TO-HAVE
```
9. Monitoring (Sentry)
10. Cache strategy
11. GraphQL API (alternativa)
12. E2E testing
```

---

## 🛠️ SKILLS A CREAR

### 1. **`nextjs-16-multitenancy-auth`** (Tier 1)
**Propósito:** Guiar implementación de NextAuth + multi-tenant Supabase

**Contenido:**
- Flujo de autenticación con empresa_codigo
- Estructura del JWT
- getTenantAdminClient() pattern
- Cómo agregar nuevos providers

**Ejemplo:**
```markdown
## Multi-Tenant Auth Flow

1. Usuario ingresa email + password + empresa_codigo
2. NextAuth busca empresa en master DB
3. Autentica contra Supabase del tenant
4. Retorna JWT con datos de sesión
5. proxy.ts valida en cada request

## Agregando nuevo tenant

1. Crear registro en master.empresas
2. Provisionar nueva base Supabase
3. Copiar schema.sql
4. Listo
```

---

### 2. **`permission-matrix-mga`** (Tier 1)
**Propósito:** Documentar y explicar sistema de permisos

**Contenido:**
- Matriz de permisos (13 módulos × 3 roles)
- Implementación client: `usePermissions()`
- Implementación server: `getModulePermisos()`
- Ejemplos de validación

**Matriz:**
```
Módulo      | Admin | Supervisor | Vendedor
------------|-------|-----------|----------
articulos   | CRUD  | Read      | Read
ventas      | CRUD  | Read      | CR
stock       | CRUD  | CRU       | -
clientes    | CRUD  | CRU       | CR
```

---

### 3. **`group-routes-protection-next16`** (Tier 1)
**Propósito:** Explicar layout groups y protección de rutas

**Contenido:**
- Qué son route groups `(dashboard)`, `(print)`, etc
- Cómo funcionan con layouts
- proxy.ts para protección
- Ejemplos de arquitectura

---

### 4. **`supabase-tenant-queries`** (Tier 2)
**Propósito:** Patrones para queries en multi-tenant

**Contenido:**
- RLS policies
- getTenantAdminClient vs anon client
- Queries seguras por tenant
- Handling de sucursales

---

### 5. **`form-handling-zod-rhf`** (Tier 2)
**Propósito:** Patrones con React Hook Form + Zod

**Contenido:**
- Setup RHF + Zod
- Validación client + server
- Error display
- Examples desde el proyecto

---

### 6. **`shadcn-tailwind-v4-styling`** (Tier 2)
**Propósito:** Guía de personalización visual

**Contenido:**
- Cómo Tailwind v4 es diferente
- Sistema de color por sucursal
- Dark mode
- Componentes shadcn

---

## 🔌 MCPs ÚTILES

| MCP | Para | Prioridad |
|-----|------|-----------|
| **Supabase JS SDK** | Queries, auth | ✅ Ya integrado |
| **NextAuth v5** | Auth flows | ⚠️ Crear documentación |
| **PostgreSQL pg_trgm** | Búsqueda fuzzy | ⚠️ Ya usado |
| **Supabase Storage** | File uploads | 📌 Documentar |
| **tRPC** (opcional) | Type-safe APIs | 💡 Considerar |
| **Prisma** (opcional) | ORM alternativo | 💡 No necesario |

### Recomendación: Crear MCP custom para `mga-punto-venta`
- Documentar patrones específicos del proyecto
- Funciones helper para tenant queries
- RPC helpers

---

## 🎨 PLUGINS VS CODE RECOMENDADOS

### TIER 1: ESENCIAL (Instalar ahora)

1. **Supabase** (official)
   ```json
   {
     "id": "supabase.supabase-js",
     "name": "Supabase"
   }
   ```
   - SQL editor inline
   - Table inspector
   - RLS visualization

2. **PostgreSQL** (Chris Kolkman)
   - IntelliSense para queries
   - Connection management

3. **Thunder Client**
   - Test API routes sin dejar editor
   - Better than Postman

### TIER 2: MUY ÚTIL

4. **ESLint** (official)
5. **Prettier** (official)
6. **Error Lens**
7. **Todo Tree**
8. **Git Lens**

### TIER 3: PRODUCTIVIDAD

9. **Indent Rainbow**
10. **Live Server**
11. **REST Client**
12. **Database Diagram** (ERD visualization)

### Setup automático

Crear `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "supabase.supabase-js",
    "chris-kolkman.vscode-postgres",
    "rangav.vscode-thunder-client",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "usernamehw.errorlens",
    "gruntfuggly.todo-tree",
    "eamodio.gitlens"
  ]
}
```

---

## 🪝 HOOKS A AGREGAR

### Categoría 1: ESTADO & DATOS

#### 1. `useFetch()` — Wrapper para fetch
```typescript
const { data, loading, error } = useFetch('/api/dashboard/articulos')
```

#### 2. `useDebounce()` — Para búsquedas
```typescript
const debouncedSearch = useDebounce(searchTerm, 500)
```

#### 3. `useLocalStorage()` — Persist estado
```typescript
const [sucursal, setSucursal] = useLocalStorage('sucursal_id', defaultId)
```

#### 4. `useAsync()` — Promise handling
```typescript
const { data, loading, error } = useAsync(() => fetchData())
```

---

### Categoría 2: TABLA & LISTA

#### 5. `useTableSort()` — Sorting state
```typescript
const { sortBy, order, toggleSort } = useTableSort('nombre')
```

#### 6. `usePagination()` — Pagination logic
```typescript
const { page, pageSize, totalPages } = usePagination(totalItems, 25)
```

#### 7. `useTableSelection()` — Row checkboxes
```typescript
const { selected, toggleSelect, selectAll } = useTableSelection(items)
```

---

### Categoría 3: CONTEXT

#### 8. `useTenant()` — Acceso al tenant actual
```typescript
const { empresaId, empresaNombre } = useTenant()
```

#### 9. `useModules()` — Módulos activos
```typescript
const modules = useModules() // ['ventas', 'stock', 'admin']
```

---

### Categoría 4: API

#### 10. `useApi()` — Fetch con auth + revalidate
```typescript
const { data, mutate } = useApi('/api/dashboard/articulos')
```

#### 11. `useMutate()` — POST/PUT/DELETE
```typescript
const { mutate, loading } = useMutate('/api/dashboard/ventas', 'POST')
```

---

### Categoría 5: UI/UX

#### 12. `useMediaQuery()` — Responsive
```typescript
const isMobile = useMediaQuery('(max-width: 768px)')
```

#### 13. `useToast()` — Notificaciones (Sonner)
```typescript
const { success, error } = useToast()
```

---

## 📁 MEJORAS DE ESTRUCTURA

### ISSUE 1: Errores de compilación TS 🔴

**Archivos afectados (4):**

```
app/api/dashboard/admin/usuarios/[id]/route.ts
├─ Error: Cannot find name 'supabase' (líneas 37, 45, 49, 51)
├─ Causa: Falta import de supabaseAdmin
└─ Fix: Agregar import

app/api/dashboard/articulos/[id]/stock-sucursales/route.ts
├─ Error: Object literal type mismatch
├─ Causa: Tipo 'nombre' incorrectamente tipado
└─ Fix: Revisar tipos en query

app/api/dashboard/articulos/route.ts
├─ Error: Type conversion errors (línea 64, 128)
├─ Causa: Type casting incorrecto
└─ Fix: Usar 'as unknown as TipoEsperado'

app/api/dashboard/articulos/seguimiento/route.ts
├─ Error: Type mismatches en RemitoItemRaw, MovRaw
├─ Causa: Mismatch entre query result y tipos
└─ Fix: Normalizar datos en query o ajustar tipos
```

**Solución:** Revisar `types/articulos.ts` y castear tipos correctamente.

---

### ISSUE 2: Falta separación Server/Client Components

**Problema:** Algunos componentes mezclan lógica de servidor con cliente.

**Solución:**
```typescript
// ✅ CORRECTO
// page.tsx (Server Component)
const data = await db.query()
return <ClientList data={data} />

// components/ClientList.tsx (Client Component)
'use client'
export function ClientList({ data }) { ... }
```

---

### ISSUE 3: Services desorganizados

**Actual:**
```
services/
├── supabase-admin.ts
├── supabase-master.ts
├── supabase-tenant.ts
├── stock.ts
└── precios.ts
```

**Propuesto:**
```
services/
├── db/
│   ├── admin.ts
│   ├── master.ts
│   ├── tenant.ts
│   └── index.ts
├── business/
│   ├── stock.ts
│   ├── precios.ts
│   └── index.ts
└── index.ts
```

---

### ISSUE 4: Validaciones duplicadas

**Problema:** Zod schemas esparcidos en múltiples archivos.

**Solución:**
```
schemas/
├── articulos.ts
├── ventas.ts
├── clientes.ts
├── ordenes.ts
└── index.ts (export *)
```

---

### ISSUE 5: API routes sin validación consistente

**Problema:**
```typescript
// Patrón A: Sin validar
export async function POST(req: Request) {
  const body = await req.json()
  // directamente a query
}

// Patrón B: Con validación
export async function POST(req: Request) {
  const body = VentasSchema.parse(await req.json())
  // query
}
```

**Solución:** Crear `lib/api-utils.ts` con middleware.

---

### ISSUE 6: Sin documentación de API routes

**Solución:** Agregar JSDoc a cada ruta.

```typescript
/**
 * POST /api/dashboard/articulos
 * 
 * Crear nuevo artículo
 * 
 * @param {Object} body - Articulo data
 * @param {string} body.codigo - SKU único
 * @param {string} body.nombre - Nombre
 * 
 * @returns {Promise<{ok: true; data: Articulo}>}
 * @throws {400} Validation error
 * @throws {401} Unauthorized
 * @throws {409} SKU duplicado
 */
export async function POST(req: Request) { ... }
```

---

## 🚀 PLAN PRIORIZADO

### **FASE 1: ESTABILIDAD** ⚡
**Duración:** 3-5 días | **Criticidad:** 🔴 MÁXIMA

#### Hitos:
1. [ ] Resolver 8 errores TypeScript
2. [ ] Completar `CLAUDE.md`
3. [ ] Crear 3 Skills prioritarios
4. [ ] `npm run build` exitoso

**Por qué primero:**
- Bloquea CI/CD
- Mejora IA insights
- Foundation para todo lo demás

---

### **FASE 2: ARQUITECTURA** 🏗️
**Duración:** 5-7 días | **Criticidad:** 🟠 ALTA

#### Hitos:
1. [ ] Crear `lib/api-utils.ts` con middleware
2. [ ] Centralizar Zod schemas en `schemas/`
3. [ ] Documentar API routes (JSDoc)
4. [ ] Crear `lib/error-handler.ts`

**Por qué después de Fase 1:**
- Necesita compilación limpia
- Aprovecha documentación completada

---

### **FASE 3: DX & TESTING** 🧪
**Duración:** 7 días | **Criticidad:** 🟠 ALTA

#### Hitos:
1. [ ] Setup Jest + React Testing Library
2. [ ] Agregar 5 hooks nuevos
3. [ ] Escribir 10+ tests
4. [ ] Instalar plugins VS Code

**Por qué después de Fase 2:**
- Más fácil escribir tests con arquitectura clara
- Hooks aprovechan nuevas utilidades

---

### **FASE 4: MONITORING** 📊
**Duración:** 5 días | **Criticidad:** 🟡 MEDIA

#### Hitos:
1. [ ] Integrar Sentry
2. [ ] Implementar logging estructurado
3. [ ] Rate limiting en rutas críticas
4. [ ] Setup alertas

**Por qué al final:**
- No bloquea funcionamiento
- Mejora observabilidad en prod

---

## 📊 MATRIZ DE PRIORIDADES

| Tarea | Fase | Duración | Impacto | Dependencias |
|-------|------|----------|--------|--------------|
| Fix errores TS | 1 | 1 día | 🔴 Crítico | Ninguna |
| CLAUDE.md | 1 | 0.5 días | 🟠 Alto | Ninguna |
| Skills (3) | 1 | 1 día | 🟠 Alto | CLAUDE.md |
| `api-utils.ts` | 2 | 1 día | 🔴 Crítico | Fase 1 |
| Schemas centralizados | 2 | 1 día | 🟠 Alto | Fase 1 |
| JSDoc en routes | 2 | 2 días | 🟡 Medio | Fase 1 |
| Error handler | 2 | 0.5 días | 🟠 Alto | Fase 1 |
| Jest setup | 3 | 1 día | 🟠 Alto | Fase 2 |
| Hooks (5) | 3 | 2 días | 🟡 Medio | Ninguna |
| Tests | 3 | 2 días | 🟠 Alto | Jest setup |
| Plugins | 3 | 0.5 días | 🟡 Medio | Ninguna |
| Sentry | 4 | 1 día | 🟡 Medio | Fase 2 |
| Logging | 4 | 1 día | 🟡 Medio | Fase 2 |
| Rate limiting | 4 | 1 día | 🟡 Medio | Fase 2 |

---

## 📈 MÉTRICAS DE ÉXITO

### Antes del plan:
```
TS Compilation Errors:    8
Documentation Coverage:   30%
Test Coverage:            0%
API Consistency:          60%
Error Handling:           Ad-hoc
CLAUDE.md:                Incomplete
```

### Después del plan:
```
TS Compilation Errors:    0 ✅
Documentation Coverage:   90% ✅
Test Coverage:            40%+ ✅
API Consistency:          95% ✅
Error Handling:           Structured ✅
CLAUDE.md:                Complete ✅
```

---

## 🎯 NEXT STEPS

### Inmediato (Hoy)
1. [ ] Revisar archivos de errores TS
2. [ ] Crear CLAUDE.md completo
3. [ ] Iniciar FASE 1

### Esta semana
1. [ ] Completar FASE 1
2. [ ] Iniciar FASE 2

### Este mes
1. [ ] Completar FASE 4
2. [ ] Implementar 50% de mejoras sugeridas

---

## 📚 REFERENCIAS

| Referencia | Ubicación |
|-----------|-----------|
| Auth system | `context/AUTH_CONTEXT.md` |
| Database schema | `context/DATABASE.md` |
| Módulo ventas | `context/modulos/ventas.md` |
| Módulo stock | `context/modulos/stock.md` |
| Stack details | `README.md` |

---

## ✍️ NOTAS FINALES

Este proyecto tiene **excelente fundación**:
- ✅ Arquitectura multi-tenant sólida
- ✅ Sistema de permisos bien diseñado
- ✅ Stack moderno y mantenible
- ✅ Documentación de contexto completa

**Lo que falta es:**
- 🔧 Estabilización (errores TS)
- 📖 Documentación de desarrollo (CLAUDE.md)
- 🧪 Testing
- 📊 Observabilidad

**Recomendación:** Seguir el plan propuesto fase a fase. Cada fase se construye sobre la anterior y agrega valor incremental.

---

**Documento generado por análisis automatizado | 2026-06-18**
