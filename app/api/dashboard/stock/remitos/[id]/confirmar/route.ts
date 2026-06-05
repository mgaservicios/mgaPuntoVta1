import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/services/supabase-tenant'
import { adjustArticuloStock, syncArticuloStock } from '@/services/stock'
import { registrarPrecio } from '@/services/precios'
import { requirePermission } from '@/lib/require-permission'

type Ctx = { params: Promise<{ id: string }> }

type PrecioExtra = { lista_precio_id: number; precio: number }
type PrecioExtraItem = { articulo_id: number; variante_id: number | null; precios: PrecioExtra[] }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('inventario.remitos.confirmar')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  // Precios adicionales pasados desde el formulario (no requieren migración de BD)
  let preciosExtrasBody: PrecioExtraItem[] = []
  try {
    const body = await req.json()
    if (Array.isArray(body?.precios_extras)) preciosExtrasBody = body.precios_extras
  } catch { /* body vacío */ }

  const { data: remito, error } = await supabase
    .from('remitos')
    .select(`id, numero, tipo, sucursal_id, contraparte_tipo, contraparte_sucursal_id, contraparte_proveedor_id, estado,
      remito_items(articulo_id, variante_id, cantidad, costo_unitario)`)
    .eq('id', id)
    .single()

  if (error || !remito) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (remito.estado !== 'borrador') return NextResponse.json({ error: 'El remito no está en borrador' }, { status: 400 })

  const items = Array.isArray(remito.remito_items) ? remito.remito_items : []
  if (items.length === 0) return NextResponse.json({ error: 'El remito no tiene ítems' }, { status: 400 })

  // ── 1. Ajustar stock en la sucursal origen ────────────────────────────────
  const delta = remito.tipo === 'entrada' ? 1 : -1
  const articuloIds = new Set<number>()

  for (const item of items) {
    const vid = item.variante_id ?? null
    const stockErr = await adjustArticuloStock(
      item.articulo_id,
      vid,
      remito.sucursal_id,
      delta * item.cantidad,
      supabase,
    )
    if (stockErr) return NextResponse.json({ error: `Error ajustando stock: ${stockErr}` }, { status: 500 })
    articuloIds.add(item.articulo_id)
  }

  for (const aid of articuloIds) await syncArticuloStock(aid, supabase)

  // ── 2. Si es entrada, registrar precios de compra ─────────────────────────
  if (remito.tipo === 'entrada') {
    const LISTA_COMPRA_ID = 1
    const origenTipo = remito.contraparte_proveedor_id ? 'proveedor' : 'remito'
    const origenProveedorId = remito.contraparte_proveedor_id ?? null

    for (const item of items) {
        if (item.costo_unitario != null) {
          await registrarPrecio(
            {
              articulo_id: item.articulo_id,
              variante_id: item.variante_id ?? null,
              lista_precio_id: LISTA_COMPRA_ID,
              precio: item.costo_unitario,
              origen_tipo: origenTipo,
              origen_proveedor_id: origenProveedorId,
              remito_id: remito.id,
              created_by: session.user.id,
            },
            supabase,
          )
        }

        // Precios adicionales pasados en el body del request
        const extrasItem = preciosExtrasBody.find(
          e => e.articulo_id === item.articulo_id && (e.variante_id ?? null) === (item.variante_id ?? null)
        )
        const extras = extrasItem?.precios ?? []
        for (const extra of extras) {
          if (extra.precio > 0) {
            await registrarPrecio(
              {
                articulo_id: item.articulo_id,
                variante_id: item.variante_id ?? null,
                lista_precio_id: extra.lista_precio_id,
                precio: extra.precio,
                origen_tipo: origenTipo,
                origen_proveedor_id: origenProveedorId,
                remito_id: remito.id,
                created_by: session.user.id,
              },
              supabase,
            )
          }
        }
      }
  }

  // ── 3. Confirmar el remito ─────────────────────────────────────────────────
  await supabase
    .from('remitos')
    .update({ estado: 'confirmado', updated_at: new Date().toISOString() })
    .eq('id', id)

  // ── 4. Si es Salida hacia otra Sucursal → crear remito Entrada en destino ──
  if (remito.tipo === 'salida' && remito.contraparte_tipo === 'sucursal' && remito.contraparte_sucursal_id) {
    const destSucursalId = remito.contraparte_sucursal_id

    // Número correlativo para el remito de entrada
    const { count } = await supabase.from('remitos').select('id', { count: 'exact', head: true })
    const numeroEntrada = `E-${String((count ?? 0) + 1).padStart(5, '0')}`

    const { data: remitoEntrada, error: errEntrada } = await supabase
      .from('remitos')
      .insert({
        numero: numeroEntrada,
        tipo: 'entrada',
        sucursal_id: destSucursalId,
        contraparte_tipo: 'sucursal',
        contraparte_sucursal_id: remito.sucursal_id,
        remito_origen_id: remito.id,
        fecha: new Date().toISOString(),
        observaciones: `Entrada automática por remito de salida ${remito.numero}`,
        estado: 'borrador',
        created_by: session.user.id,
      })
      .select()
      .single()

    if (errEntrada || !remitoEntrada) {
      return NextResponse.json({
        ok: true,
        warning: `Remito de salida confirmado pero no se pudo crear el remito de entrada en destino: ${errEntrada?.message}`,
      })
    }

    // Insertar los mismos ítems en el remito de entrada
    await supabase.from('remito_items').insert(
      items.map(item => ({
        remito_id: remitoEntrada.id,
        articulo_id: item.articulo_id,
        variante_id: item.variante_id ?? null,
        cantidad: item.cantidad,
        costo_unitario: item.costo_unitario ?? null,
      }))
    )

    // Ajustar stock en la sucursal destino (entrada = +1) + registrar movimiento
    const articuloIdsDestino = new Set<number>()
    for (const item of items) {
      const vidD = item.variante_id ?? null

      let sqQD = supabase
        .from('articulo_stock')
        .select('stock_actual')
        .eq('articulo_id', item.articulo_id)
        .eq('sucursal_id', destSucursalId)
      sqQD = vidD === null ? sqQD.is('variante_id', null) : sqQD.eq('variante_id', vidD)
      const { data: sqRowD } = await sqQD.maybeSingle()
      const stockAntesD = Number(sqRowD?.stock_actual ?? 0)

      const stockErr = await adjustArticuloStock(
        item.articulo_id,
        vidD,
        destSucursalId,
        item.cantidad,
        supabase,
      )
      if (stockErr) {
        return NextResponse.json({
          ok: true,
          warning: `Remito de entrada creado pero error al ajustar stock destino: ${stockErr}`,
        })
      }
      articuloIdsDestino.add(item.articulo_id)

      await supabase.from('movimientos_stock').insert({
        articulo_id: item.articulo_id,
        variante_id: vidD,
        sucursal_id: destSucursalId,
        tipo: 'entrada',
        cantidad: item.cantidad,
        stock_antes: stockAntesD,
        stock_despues: stockAntesD + item.cantidad,
        referencia: remitoEntrada.numero,
        usuario_id: session.user.id,
      })
    }

    for (const aid of articuloIdsDestino) await syncArticuloStock(aid, supabase)

    // Confirmar el remito de entrada
    await supabase
      .from('remitos')
      .update({ estado: 'confirmado', updated_at: new Date().toISOString() })
      .eq('id', remitoEntrada.id)

    return NextResponse.json({ ok: true, remito_entrada_id: remitoEntrada.id, remito_entrada_numero: numeroEntrada })
  }

  return NextResponse.json({ ok: true })
}
