import type { SupabaseClient } from '@supabase/supabase-js'
import type { ListaPrecio, Precio, PrecioVigente } from '@/types/precios'

export function calcularPrecioLista(precioBase: number, porcentaje: number): number {
  return precioBase * (1 + porcentaje / 100)
}

const PRECIOS_SELECT = `
  *,
  lista_precio:lista_precio_id(id, nombre, tipo, categoria),
  proveedor:origen_proveedor_id(nombre),
  sucursal:origen_sucursal_id(nombre)
`

function buildVigenteMap(rows: Precio[]): Map<number, Precio> {
  const m = new Map<number, Precio>()
  for (const p of rows) {
    if (!m.has(p.lista_precio_id)) m.set(p.lista_precio_id, p)
  }
  return m
}

/** Fin del día actual en UTC, para incluir registros con timestamp al guardar */
function endOfDayUtc(): string {
  return new Date().toISOString().slice(0, 10) + 'T23:59:59'
}

/**
 * Inserta una nueva entrada de precio para un artículo/variante en una lista manual.
 * - Si variante_id es null y el artículo tiene variantes, actualiza el caché de precio
 *   en TODAS las variantes que no tengan su propio precio para esa lista.
 * - Si variante_id está dado, actualiza sólo el caché de esa variante.
 * - Si lista 1 (compra) y lista 2 (venta) es calculada, actualiza también precio_venta.
 */
export async function registrarPrecio(
  params: {
    articulo_id: number
    variante_id?: number | null
    lista_precio_id: number
    precio: number
    origen_tipo: 'manual' | 'proveedor' | 'sucursal' | 'remito'
    origen_proveedor_id?: number | null
    origen_sucursal_id?: number | null
    remito_id?: number | null
    created_by?: string | null
    vigente_desde?: string
  },
  supabase: SupabaseClient,
): Promise<string | null> {
  const { error } = await supabase.from('precios').insert({
    articulo_id: params.articulo_id,
    variante_id: params.variante_id ?? null,
    lista_precio_id: params.lista_precio_id,
    precio: params.precio,
    vigente_desde: params.vigente_desde ?? new Date().toISOString(),
    origen_tipo: params.origen_tipo,
    origen_proveedor_id: params.origen_proveedor_id ?? null,
    origen_sucursal_id: params.origen_sucursal_id ?? null,
    remito_id: params.remito_id ?? null,
    created_by: params.created_by ?? null,
  })
  if (error) return error.message

  const esVenta  = params.lista_precio_id === 2
  const esCompra = params.lista_precio_id === 1
  if (!esVenta && !esCompra) return null

  // Solo actualizar el caché si el precio ya está vigente (vigente_desde <= hoy)
  const today = new Date().toISOString().slice(0, 10)
  const fechaVigencia = (params.vigente_desde ?? '').slice(0, 10) || today
  if (fechaVigencia > today) return null

  const campo = esVenta ? 'precio_venta' : 'precio_compra'

  if (params.variante_id) {
    await supabase
      .from('articulo_variantes')
      .update({ [campo]: params.precio })
      .eq('id', params.variante_id)

    // Si se actualizó compra y lista 2 es calculada, actualizar precio_venta de la variante
    if (esCompra) {
      const precioVenta = await getPrecioVentaCalculado(params.precio, supabase)
      if (precioVenta != null) {
        await supabase
          .from('articulo_variantes')
          .update({ precio_venta: precioVenta })
          .eq('id', params.variante_id)
      }
    }
  } else {
    await supabase
      .from('articulos')
      .update({ [campo]: params.precio })
      .eq('id', params.articulo_id)

    // Variantes que ya tienen su propio precio para esta lista → no tocar
    const { data: variantesConPrecioPropio } = await supabase
      .from('precios')
      .select('variante_id')
      .eq('articulo_id', params.articulo_id)
      .eq('lista_precio_id', params.lista_precio_id)
      .not('variante_id', 'is', null)

    const idsConPrecio = new Set(
      (variantesConPrecioPropio ?? []).map((r: { variante_id: number }) => r.variante_id)
    )

    const { data: todasVariantes } = await supabase
      .from('articulo_variantes')
      .select('id')
      .eq('articulo_id', params.articulo_id)

    const sinPrecioPropio = (todasVariantes ?? [])
      .filter((v: { id: number }) => !idsConPrecio.has(v.id))
      .map((v: { id: number }) => v.id)

    if (sinPrecioPropio.length > 0) {
      await supabase
        .from('articulo_variantes')
        .update({ [campo]: params.precio })
        .in('id', sinPrecioPropio)
    }

    // Si se actualizó compra y lista 2 es calculada, actualizar precio_venta del artículo y variantes
    if (esCompra) {
      const precioVenta = await getPrecioVentaCalculado(params.precio, supabase)
      if (precioVenta != null) {
        await supabase
          .from('articulos')
          .update({ precio_venta: precioVenta })
          .eq('id', params.articulo_id)

        // Solo variantes sin precio propio de venta (lista 2)
        const { data: variantesConVenta } = await supabase
          .from('precios')
          .select('variante_id')
          .eq('articulo_id', params.articulo_id)
          .eq('lista_precio_id', 2)
          .not('variante_id', 'is', null)

        const idsConVenta = new Set(
          (variantesConVenta ?? []).map((r: { variante_id: number }) => r.variante_id)
        )
        const sinVentaPropia = sinPrecioPropio.filter(id => !idsConVenta.has(id))
        if (sinVentaPropia.length > 0) {
          await supabase
            .from('articulo_variantes')
            .update({ precio_venta: precioVenta })
            .in('id', sinVentaPropia)
        }
      }
    }
  }

  return null
}

/** Devuelve el precio de venta calculado si lista 2 es una lista calculada basada en lista 1. */
async function getPrecioVentaCalculado(
  precioCompra: number,
  supabase: SupabaseClient,
): Promise<number | null> {
  const { data: listaVenta } = await supabase
    .from('listas_precio')
    .select('porcentaje')
    .eq('id', 2)
    .eq('tipo', 'calculada')
    .eq('lista_base_id', 1)
    .eq('activo', true)
    .single()

  if (!listaVenta) return null
  return calcularPrecioLista(precioCompra, Number(listaVenta.porcentaje))
}

/**
 * Devuelve los precios vigentes de un artículo/variante en todas las listas activas.
 * - Si variante_id es null: precios del artículo base.
 * - Si variante_id está dado: precio específico de la variante; si no tiene para una lista,
 *   hereda el precio base del artículo (marcado como heredado=true).
 * - Listas calculadas se resuelven on-the-fly.
 */
export async function getPreciosVigentes(
  articulo_id: number,
  variante_id: number | null,
  supabase: SupabaseClient,
): Promise<PrecioVigente[]> {
  const { data: listas } = await supabase
    .from('listas_precio')
    .select('*, lista_base:lista_base_id(id, nombre)')
    .eq('activo', true)
    .order('id')

  if (!listas?.length) return []

  const endOfDay = endOfDayUtc()

  // Precios específicos de la variante (o del artículo si variante_id=null)
  let q = supabase
    .from('precios')
    .select(PRECIOS_SELECT)
    .eq('articulo_id', articulo_id)
    .lte('vigente_desde', endOfDay)
    .order('vigente_desde', { ascending: false })

  q = variante_id ? q.eq('variante_id', variante_id) : q.is('variante_id', null)
  const { data: historialPropio } = await q
  const propioMap = buildVigenteMap((historialPropio ?? []) as Precio[])

  // Si es variante, también buscar los precios base del artículo para herencia
  let baseMap = new Map<number, Precio>()
  if (variante_id) {
    const { data: historialBase } = await supabase
      .from('precios')
      .select(PRECIOS_SELECT)
      .eq('articulo_id', articulo_id)
      .is('variante_id', null)
      .lte('vigente_desde', endOfDay)
      .order('vigente_desde', { ascending: false })
    baseMap = buildVigenteMap((historialBase ?? []) as Precio[])
  }

  const result: PrecioVigente[] = []

  for (const lista of listas as (ListaPrecio & { lista_base?: { id: number; nombre: string } | null })[]) {
    if (lista.tipo === 'manual') {
      const propio = propioMap.get(lista.id)
      const base   = baseMap.get(lista.id)

      if (propio) {
        result.push({ ...propio, heredado: false })
      } else if (base) {
        result.push({ ...base, variante_id, heredado: true })
      } else {
        result.push({
          id: 0, articulo_id, variante_id,
          lista_precio_id: lista.id, precio: 0, vigente_desde: '',
          origen_tipo: null, origen_proveedor_id: null, origen_sucursal_id: null,
          remito_id: null, created_by: null, created_at: '',
          lista_precio: { id: lista.id, nombre: lista.nombre, tipo: lista.tipo, categoria: lista.categoria },
          heredado: false,
        })
      }
    } else if (lista.tipo === 'calculada' && lista.lista_base_id && lista.porcentaje != null) {
      // Precio de la lista base (para derivación dinámica)
      const propioBase   = propioMap.get(lista.lista_base_id)
      const heredadoBase = baseMap.get(lista.lista_base_id)
      const fuenteBase   = propioBase ?? heredadoBase
      const baseDate     = fuenteBase?.vigente_desde?.slice(0, 10) ?? ''

      // Override guardado directamente en esta lista calculada
      const propioOverride = propioMap.get(lista.id)
      const baseOverride   = baseMap.get(lista.id)
      const overrideSrc    = propioOverride ?? baseOverride
      const overrideDate   = overrideSrc?.vigente_desde?.slice(0, 10) ?? ''

      // El override tiene prioridad SOLO si es más reciente o igual al precio base
      if (overrideSrc && overrideDate >= baseDate) {
        result.push({
          ...overrideSrc,
          variante_id: propioOverride ? variante_id : null,
          lista_precio: { id: lista.id, nombre: lista.nombre, tipo: lista.tipo, categoria: lista.categoria },
          precio_calculado: overrideSrc.precio,
          heredado: !propioOverride && !!baseOverride && !!variante_id,
        })
      } else {
        // Derivar dinámicamente del precio base
        const precioBase = fuenteBase?.precio ?? 0
        const precioCalculado = precioBase > 0
          ? calcularPrecioLista(precioBase, Number(lista.porcentaje))
          : 0
        result.push({
          id: 0, articulo_id, variante_id,
          lista_precio_id: lista.id, precio: precioCalculado,
          vigente_desde: fuenteBase?.vigente_desde ?? '',
          origen_tipo: null, origen_proveedor_id: null, origen_sucursal_id: null,
          remito_id: null, created_by: null, created_at: '',
          lista_precio: { id: lista.id, nombre: lista.nombre, tipo: lista.tipo, categoria: lista.categoria },
          precio_calculado: precioCalculado,
          heredado: !propioBase && !!heredadoBase,
        })
      }
    }
  }

  return result
}
