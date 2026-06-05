# articulos.md — Artículos y Catálogo

Adjuntá este archivo para trabajar en artículos, variantes, categorías y catálogos.

---

## Archivos del módulo

| Archivo | Descripción |
|---------|-------------|
| `app/(dashboard)/dashboard/articulos/page.tsx` | Lista de artículos con sub-filas de variantes |
| `app/(dashboard)/dashboard/articulos/nuevo/page.tsx` | Crear artículo |
| `app/(dashboard)/dashboard/articulos/[id]/page.tsx` | Editar artículo + gestión de variantes |
| `app/api/dashboard/articulos/route.ts` | GET (lista + búsqueda) + POST (crear) |
| `app/api/dashboard/articulos/[id]/route.ts` | GET + PUT + DELETE (desactivar) |
| `app/api/dashboard/articulos/[id]/variantes/route.ts` | GET + POST variantes |
| `app/api/dashboard/articulos/[id]/variantes/[varianteId]/route.ts` | PUT + DELETE variante |
| `app/api/dashboard/articulos/next-code/route.ts` | GET siguiente código disponible |
| `app/api/dashboard/articulos/upload-image/route.ts` | POST subir imagen |
| `types/articulos.ts` | Tipos TypeScript |

---

## Tipos de artículo

**Simple:** Un solo precio y stock. Sin variantes.

**Con variantes:** El artículo es un contenedor; precio y stock están en cada variante.
`articulos.precio_venta` es null. `articulos.stock_actual` es la suma total de todas las variantes en todas las sucursales.

El `tipo_articulo` es **inmutable** una vez creado.

---

## Variantes

Cada variante tiene:
- `sku`: código único generado automáticamente (codigo_articulo + valores de atributos)
- `precio_venta` / `precio_compra`: propios de la variante
- `stock_actual`: total calculado sumando `articulo_stock` de todas las sucursales
- `variante_atributos`: combinación de atributo_tipo + valor (ej: Talle=L, Color=Rojo)

Un artículo puede tener múltiples tipos de atributo (Talle, Color, etc.) con valores libres.
Constraint: una variante no puede tener dos valores del mismo tipo de atributo.

---

## Stock — fuente de verdad

El stock REAL está en `articulo_stock(articulo_id, variante_id, sucursal_id, stock_actual)`.

`articulos.stock_actual` y `articulo_variantes.stock_actual` son **campos calculados** para display,
actualizados por `syncArticuloStock(articulo_id)` en `services/stock.ts`.

**Nunca escribir directamente en `articulos.stock_actual` ni en `articulo_variantes.stock_actual`.**
Siempre usar `adjustArticuloStock()` y luego `syncArticuloStock()`.

---

## Búsqueda de artículos

La API usa `buscar_articulos(p_query, p_limit)` RPC cuando hay query string.
Combina:
- `nombre ILIKE '%query%'`
- `codigo ILIKE '%query%'`
- `codigo_barras ILIKE '%query%'`
- `similarity(nombre, query) > 0.3` (pg_trgm)

La lista general (sin query) usa select directo con `articulo_variantes` anidadas para mostrar sub-filas.

---

## Lista de artículos (page.tsx)

La tabla muestra:
- **Artículo simple:** Una fila con nombre, código, categoría, precio, stock total, estado.
- **Artículo con variantes:** Una fila madre (precio=—, stock=total) + sub-filas indentadas por variante con SKU, precio individual y stock individual.

Las sub-filas tienen fondo gris sutil (`bg-gray-50/70`) y la descripción de atributos (ej: "Talle: L / Color: Rojo").

---

## Catálogos relacionados

- `categorias`: agrupación de artículos (ej: Calzado, Ropa)
- `marcas`: marca del fabricante
- `atributo_tipos`: tipos de atributo para variantes (Talle, Color, Tamaño, Material)
- `proveedores`: proveedor del artículo

---

## Tipos clave (`types/articulos.ts`)

```typescript
type TipoArticulo = 'simple' | 'con_variantes'

type Articulo = {
  id: number
  codigo: string | null
  nombre: string
  descripcion: string | null
  tipo_articulo: TipoArticulo
  categoria_id: number | null
  marca_id: number | null
  proveedor_id: number | null
  precio_venta: number | null    // null para con_variantes
  precio_compra: number | null
  stock_actual: number           // total calculado, no editar directamente
  stock_minimo: number
  unidad: string
  codigo_barras: string | null
  activo: boolean
  imagen_url: string | null
}

type ArticuloVariante = {
  id: number
  articulo_id: number
  sku: string | null
  codigo_barras: string | null
  precio_venta: number | null
  precio_compra: number | null
  stock_actual: number           // total calculado
  stock_minimo: number
  activo: boolean
}

type VarianteAtributo = {
  variante_id: number
  atributo_tipo_id: number
  valor: string
}
```

---

*Última actualización: 2026-05-28*
