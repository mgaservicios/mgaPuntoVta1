# clientes.md — Clientes y Proveedores

Adjuntá este archivo para trabajar en el módulo de clientes o proveedores.

---

## Archivos del módulo

| Archivo | Descripción |
|---------|-------------|
| `app/(dashboard)/dashboard/clientes/page.tsx` | Lista de clientes |
| `app/(dashboard)/dashboard/clientes/nuevo/page.tsx` | Crear cliente |
| `app/(dashboard)/dashboard/clientes/[id]/page.tsx` | Detalle / editar |
| `app/api/dashboard/clientes/route.ts` | GET + POST |
| `app/api/dashboard/clientes/[id]/route.ts` | GET + PUT + DELETE |
| `app/(dashboard)/dashboard/proveedores/page.tsx` | Lista de proveedores |
| `app/(dashboard)/dashboard/proveedores/nuevo/page.tsx` | Crear proveedor |
| `app/(dashboard)/dashboard/proveedores/[id]/page.tsx` | Detalle / editar |
| `app/api/dashboard/proveedores/route.ts` | GET + POST |
| `app/api/dashboard/proveedores/[id]/route.ts` | GET + PUT + DELETE |
| `types/clientes.ts` | Tipos clientes |
| `types/proveedores.ts` | Tipos proveedores |

---

## Clientes

### Campos
- `nombre` (con índice GIN trgm para búsqueda fuzzy)
- `tipo`: `'PARTICULAR' | 'EMPRESA' | 'COMERCIO'`
- `email`, `telefono`, `direccion`, `localidad`, `cuit`
- `notas`: texto libre
- `activo`: activos/inactivos

### Búsqueda
La API usa `ILIKE '%query%'` sobre `nombre`. El índice GIN optimiza la consulta.

### Saldo de cuenta corriente
Visible en el detalle del cliente. Calculado con la función SQL `saldo_cliente(id)`:
- Positivo = cliente debe al negocio
- Negativo = saldo a favor del cliente

El historial de cargos y pagos está en la tabla `cobranzas`.

---

## Proveedores

Campos: `nombre`, `cuit`, `telefono`, `email`, `direccion`, `localidad`, `notas`, `activo`.

Se usan como referencia en:
- `articulos.proveedor_id` — proveedor del artículo
- `remitos.contraparte_proveedor_id` — cuando un remito viene de un proveedor

---

## Tipos clave

```typescript
// types/clientes.ts
type ClienteTipo = 'PARTICULAR' | 'EMPRESA' | 'COMERCIO'

type Cliente = {
  id: number
  nombre: string
  tipo: ClienteTipo
  email: string | null
  telefono: string | null
  direccion: string | null
  localidad: string | null
  cuit: string | null
  notas: string | null
  activo: boolean
}

// types/proveedores.ts
type Proveedor = {
  id: number
  nombre: string
  cuit: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  localidad: string | null
  notas: string | null
  activo: boolean
}
```

---

*Última actualización: 2026-05-28*
