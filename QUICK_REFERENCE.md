# 🚀 QUICK REFERENCE — MGA POS

> Guía rápida de acceso a información clave

---

## 📍 RESPUESTAS DIRECTAS

### ¿Falta CLAUDE.md?
❌ No, pero **está incompleto**. Necesita:
- Descripción general
- Setup local
- Convenciones de código
- Feature guidelines
- Links a contexto

### ¿Qué Skills crear?
**TOP 3:**
1. `nextjs-16-multitenancy-auth`
2. `permission-matrix-mga`
3. `group-routes-protection-next16`

**Después:**
4. `supabase-tenant-queries`
5. `form-handling-zod-rhf`
6. `shadcn-tailwind-v4-styling`

### ¿Qué MCPs?
- ✅ Ya integrados: Supabase, NextAuth, pg_trgm
- 🆕 Crear custom: MGA Point-of-Sale patterns
- 💡 Optional: tRPC, Prisma (futuro)

### ¿Plugins VS Code?
**ESENCIAL:**
- Supabase (official)
- PostgreSQL (Chris Kolkman)
- Thunder Client

**MUY ÚTIL:**
- ESLint, Prettier, Error Lens, Git Lens, Todo Tree

### ¿Hooks a agregar?
**13 hooks nuevos:**
- Datos: useFetch, useDebounce, useLocalStorage, useAsync
- Tabla: useTableSort, usePagination, useTableSelection
- Context: useTenant, useModules
- API: useApi, useMutate
- UI: useMediaQuery, useToast

### ¿Mejoras de estructura?
1. **CRÍTICO:** Fix 8 errores TS
2. Crear `lib/api-utils.ts`
3. Centralizar Zod en `schemas/`
4. Documentar routes con JSDoc
5. Error handling consistente

### ¿Arquitectura sigue buenas prácticas?
**⭐⭐⭐⭐ Excelente (4/5)**

✅ BIEN:
- Multi-tenancy sólida
- RBAC granular
- App Router correcto
- TypeScript strict
- Autenticación robusta

⚠️ MEJORA:
- 0% testing (CRÍTICO)
- Error handling inconsistente
- CLAUDE.md incompleto
- Sin monitoring

### Plan priorizado
**4 FASES (4 semanas total):**

| Fase | Duración | Hitos |
|------|----------|-------|
| 1 | 3-5 días | Fix errores TS + CLAUDE.md + Skills |
| 2 | 5-7 días | api-utils + schemas + JSDoc |
| 3 | 7 días | Jest + hooks + tests |
| 4 | 5 días | Sentry + logging + rate limit |

---

## 📂 ARCHIVOS CLAVES

### Contexto
```
context/
├── AUTH_CONTEXT.md          # Autenticación
├── CONTEXT.md               # Overview general
├── DATABASE.md              # Schema BD
└── modulos/
    ├── ventas.md
    ├── stock.md
    ├── clientes.md
    ├── optica-ordenes.md
    └── ... (13 total)
```

### Código
```
app/
├── (dashboard)/dashboard/   # Routes protegidas
├── api/dashboard/           # API backend
├── api/superadmin/          # API super-admin
├── auth/                    # Auth flows
└── (print)/                 # Print layout

services/
├── supabase-admin.ts
├── supabase-master.ts
├── supabase-tenant.ts
├── stock.ts
└── precios.ts

lib/
├── auth.ts
├── permisos.ts
├── sucursal.ts
├── utils.ts
├── api-utils.ts (CREAR)
└── error-handler.ts (CREAR)

hooks/
├── usePermissions.ts
├── useSucursalActiva.ts
├── useSelectedSucursal.ts
├── useVendedores.ts
└── (11 más por crear)

types/
├── auth.ts
├── articulos.ts
├── ventas.ts
├── ... (13 módulos)
```

---

## 🔴 ERRORES TS A FIJAR

| Archivo | Línea | Error |
|---------|-------|-------|
| `admin/usuarios/[id]/route.ts` | 37, 45, 49, 51 | Cannot find 'supabase' |
| `articulos/stock-sucursales/route.ts` | 43 | Type mismatch 'nombre' |
| `articulos/route.ts` | 64, 128 | Type conversion |
| `articulos/seguimiento/route.ts` | 140, 184 | Type mismatch RemitoItemRaw |

---

## 🎯 PRÓXIMOS PASOS

```
HOJA DE RUTA (Hoy/Esta semana)
├─ [30 min] Leer ANALISIS_COMPLETO.md
├─ [30 min] Leer RESUMEN_EJECUTIVO.md
├─ [30 min] Revisar archivos con errores TS
├─ [1 h] Revisar types/articulos.ts
├─ [2-3 h] Fijar primer error TS
├─ [1 h] Iniciar CLAUDE.md
└─ [Próx semana] Continuar FASE 1

INICIADOR RÁPIDO:
1. npm install (si no está)
2. npm run build (ver errores)
3. Abrir tsc_out.txt
4. Revisar primer error
5. Fijar imports/tipos
6. Repetir hasta clean build
```

---

## 💾 MEMORIA COMPARTIDA

Análisis guardado en:
- `/memories/repo/mga-pos-analysis.md` — Análisis completo
- `/memories/repo/plan-priorizado.md` — Plan operativo

Acceso desde cualquier chat futuro sobre este proyecto.

---

## 🔗 LINKS ÚTILES

**Documentación del proyecto:**
- `ANALISIS_COMPLETO.md` ← EMPEZAR AQUÍ
- `RESUMEN_EJECUTIVO.md` ← Respuestas directas
- `QUICK_REFERENCE.md` ← Este archivo
- `context/CONTEXT.md` ← Overview general
- `context/AUTH_CONTEXT.md` ← Sistema de permisos

**Recursos externos:**
- [Next.js 16 docs](https://nextjs.org/docs)
- [NextAuth v5 docs](https://authjs.dev/)
- [Supabase docs](https://supabase.com/docs)
- [Zod docs](https://zod.dev)
- [shadcn/ui](https://ui.shadcn.com)

---

## ⏰ TIME BUDGET

Estimado para FASE 1:

```
Actividad                    | Tiempo
-----------------------------|--------
Leer análisis                | 1 h
Revisar archivos con errores | 0.5 h
Fijar errores TS (8)         | 2-3 h
CLAUDE.md completo           | 1.5 h
Crear Skills (3)             | 3-4 h
Testing npm run build        | 0.5 h
-----------------------------|--------
TOTAL FASE 1                 | ~9-10 h
```

**Día 1:** Leer + revisar errores  
**Día 2-3:** Fijar errores TS  
**Día 3-4:** CLAUDE.md + Skills  
**Día 5:** Validar + cleanup

---

## 🎨 ESTRUCTURA PROPUESTA (POST-REFACTOR)

```
app/
├── (auth)/
│   ├── signin/
│   ├── signup/
│   └── layout.tsx
├── (dashboard)/
│   ├── dashboard/
│   │   ├── ventas/
│   │   ├── stock/
│   │   ├── admin/
│   │   └── optica/
│   └── layout.tsx (protegida)
├── (print)/
│   └── layout.tsx
├── api/
│   ├── auth/
│   ├── dashboard/
│   └── superadmin/
└── layout.tsx (root)

lib/
├── auth.ts
├── api-utils.ts ✨ (CREAR)
├── error-handler.ts ✨ (CREAR)
├── permisos.ts
├── sucursal.ts
└── utils.ts

services/
├── db/ ✨
│   ├── admin.ts
│   ├── master.ts
│   ├── tenant.ts
│   └── index.ts
├── business/ ✨
│   ├── stock.ts
│   ├── precios.ts
│   └── index.ts
└── index.ts

schemas/ ✨ (CREAR)
├── articulos.ts
├── ventas.ts
├── clientes.ts
└── index.ts

hooks/
├── useFetch.ts ✨
├── useDebounce.ts ✨
├── useLocalStorage.ts ✨
├── (10 más)
└── index.ts

components/
├── dashboard/
├── ui/
└── shared/

types/
├── (módulos)
└── index.ts
```

---

## 🚨 ADVERTENCIAS

⚠️ **NO hacer aún:**
- Instalar nuevas dependencias (npm add)
- Hacer deploy a producción
- Refactorizar todo de una vez

✅ **Hacer primero:**
- Fix errores TS (bloquea todo)
- CLAUDE.md (mejora IA)
- Testing (da confianza)

---

## 📞 CONTACTO / APOYO

Si necesitas:
- **Clarificar el análisis** → Leer ANALISIS_COMPLETO.md
- **Ayuda con errores TS** → Compartir archivo + error exacto
- **Código para FASE 1** → Pedir Skills específico
- **Guía de implementación** → Usar plan-priorizado.md

---

**Última actualización:** 2026-06-18  
**Duración análisis:** ~2 horas  
**Confianza:** Alta (basado en código real)
