import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Mueve stock en articulo_stock (upsert per sucursal).
 * delta > 0 = entrada, delta < 0 = salida.
 * No llama syncArticuloStock — el caller debe hacerlo una vez por articulo_id al terminar el loop.
 */
export async function adjustArticuloStock(
  articulo_id: number,
  variante_id: number | null,
  sucursal_id: number,
  delta: number,
  supabase: SupabaseClient,
): Promise<string | null> {
  const vid = variante_id ?? null
  let q = supabase
    .from('articulo_stock')
    .select('stock_actual')
    .eq('articulo_id', articulo_id)
    .eq('sucursal_id', sucursal_id)

  if (vid === null) {
    q = q.is('variante_id', null)
  } else {
    q = q.eq('variante_id', vid)
  }

  const { data: existing, error: selectError } = await q.maybeSingle()
  if (selectError) return selectError.message

  if (existing) {
    let upQ = supabase
      .from('articulo_stock')
      .update({ stock_actual: Number(existing.stock_actual) + delta })
      .eq('articulo_id', articulo_id)
      .eq('sucursal_id', sucursal_id)
    if (vid === null) { upQ = upQ.is('variante_id', null) }
    else { upQ = upQ.eq('variante_id', vid) }
    const { error: updateError } = await upQ
    if (updateError) return updateError.message
  } else {
    const { error: insertError } = await supabase.from('articulo_stock').insert({
      articulo_id,
      variante_id: vid,
      sucursal_id,
      stock_actual: delta,
      stock_minimo: 0,
    })
    if (insertError) return insertError.message
  }
  return null
}

/**
 * Recalcula los campos de display globales sumando desde articulo_stock.
 * - articulo_variantes.stock_actual = suma de articulo_stock para esa variante (todas las sucursales)
 * - articulos.stock_actual = suma total del artículo (todas las sucursales y variantes)
 */
export async function syncArticuloStock(articulo_id: number, supabase: SupabaseClient): Promise<void> {
  const { data: rows } = await supabase
    .from('articulo_stock')
    .select('variante_id, stock_actual')
    .eq('articulo_id', articulo_id)

  if (!rows) return

  const varianteTotals: Record<number, number> = {}
  let totalSinVariante = 0

  for (const row of rows) {
    if (row.variante_id) {
      varianteTotals[row.variante_id] = (varianteTotals[row.variante_id] ?? 0) + Number(row.stock_actual)
    } else {
      totalSinVariante += Number(row.stock_actual)
    }
  }

  for (const [vid, total] of Object.entries(varianteTotals)) {
    await supabase
      .from('articulo_variantes')
      .update({ stock_actual: total })
      .eq('id', Number(vid))
  }

  const hasVariants = Object.keys(varianteTotals).length > 0
  const totalArticulo = hasVariants
    ? Object.values(varianteTotals).reduce((a, b) => a + b, 0)
    : totalSinVariante

  await supabase
    .from('articulos')
    .update({ stock_actual: totalArticulo })
    .eq('id', articulo_id)
}
