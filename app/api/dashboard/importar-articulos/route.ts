import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/services/supabase-tenant'
import { requirePermission } from '@/lib/require-permission'
import { registrarPrecio, calcularPrecioLista } from '@/services/precios'

type InputRow = {
  codigo?: string | null
  nombre: string
  categoria?: string | null
  subcategoria?: string | null
  marca?: string | null
  proveedor: string
  unidad?: string | null
  precio_compra?: number | null
  precio_venta?: number | null
  precio_mayorista?: number | null
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('inventario.articulos.crear')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { rows } = (await req.json()) as { rows: InputRow[] }
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'Sin filas' }, { status: 400 })

  const valid = rows.filter(r => r.nombre?.trim() && r.proveedor?.trim())
  if (valid.length === 0)
    return NextResponse.json({ error: 'Ninguna fila tiene nombre y proveedor' }, { status: 400 })

  // ── Listas de precio ──────────────────────────────────────────────────────
  const { data: listas } = await supabase
    .from('listas_precio')
    .select('id, nombre, tipo, categoria, lista_base_id, porcentaje')
    .eq('activo', true)
    .order('id')
  const listaMap = new Map((listas ?? []).map(l => [l.id as number, l]))

  // ── Unidades ──────────────────────────────────────────────────────────────
  const { data: unidades } = await supabase
    .from('unidades_medida')
    .select('id, nombre')
    .eq('activo', true)
  const unidadMap = new Map((unidades ?? []).map(u => [u.nombre.toLowerCase(), u.id as number]))
  const defaultUnidadId = unidades?.find(u => u.nombre.toLowerCase() === 'unidad')?.id ?? null

  // ── Categorías (fetch-then-insert para comparación case-insensitive) ───────
  const catNames = [...new Set(valid.map(r => r.categoria?.trim()).filter(Boolean) as string[])]
  const { data: existingCats } = await supabase.from('categorias').select('id, nombre')
  const catMap = new Map((existingCats ?? []).map(c => [c.nombre.toLowerCase(), c.id as number]))
  const missingCats = catNames.filter(n => !catMap.has(n.toLowerCase()))
  if (missingCats.length > 0) {
    const { data: newCats } = await supabase
      .from('categorias')
      .insert(missingCats.map(nombre => ({ nombre, activo: true })))
      .select('id, nombre')
    for (const c of newCats ?? []) catMap.set(c.nombre.toLowerCase(), c.id as number)
  }

  // ── Subcategorías (fetch-then-insert, case-insensitive por nombre+cat) ────
  type SubPair = { nombre: string; categoria_id: number }
  const subPairsMap = new Map<string, SubPair>()
  for (const r of valid) {
    if (!r.subcategoria?.trim() || !r.categoria?.trim()) continue
    const cat_id = catMap.get(r.categoria.trim().toLowerCase())
    if (!cat_id) continue
    const key = `${r.subcategoria.trim().toLowerCase()}|${cat_id}`
    if (!subPairsMap.has(key))
      subPairsMap.set(key, { nombre: r.subcategoria.trim(), categoria_id: cat_id })
  }
  const { data: existingSubs } = await supabase.from('subcategorias').select('id, nombre, categoria_id')
  const subMap = new Map(
    (existingSubs ?? []).map(s => [`${s.nombre.toLowerCase()}|${s.categoria_id}`, s.id as number]),
  )
  const missingSubs = [...subPairsMap.values()].filter(p => !subMap.has(`${p.nombre.toLowerCase()}|${p.categoria_id}`))
  if (missingSubs.length > 0) {
    const { data: newSubs } = await supabase
      .from('subcategorias')
      .insert(missingSubs.map(p => ({ ...p, activo: true })))
      .select('id, nombre, categoria_id')
    for (const s of newSubs ?? []) subMap.set(`${s.nombre.toLowerCase()}|${s.categoria_id}`, s.id as number)
  }

  // ── Marcas (fetch-then-insert para comparación case-insensitive) ──────────
  const marcaNames = [...new Set(valid.map(r => r.marca?.trim()).filter(Boolean) as string[])]
  const { data: existingMarcas } = await supabase.from('marcas').select('id, nombre')
  const marcaMap = new Map((existingMarcas ?? []).map(m => [m.nombre.toLowerCase(), m.id as number]))
  const missingMarcas = marcaNames.filter(n => !marcaMap.has(n.toLowerCase()))
  if (missingMarcas.length > 0) {
    const { data: newMarcas } = await supabase
      .from('marcas')
      .insert(missingMarcas.map(nombre => ({ nombre, activo: true })))
      .select('id, nombre')
    for (const m of newMarcas ?? []) marcaMap.set(m.nombre.toLowerCase(), m.id as number)
  }

  // ── Proveedores (sin unique en nombre → fetch + insert faltantes) ─────────
  const provNames = [...new Set(valid.map(r => r.proveedor.trim()))]
  const { data: existingProvs } = await supabase
    .from('proveedores')
    .select('id, nombre')
    .in('nombre', provNames)
  const provMap = new Map((existingProvs ?? []).map(p => [p.nombre.toLowerCase(), p.id as number]))

  const missingProvs = provNames.filter(n => !provMap.has(n.toLowerCase()))
  if (missingProvs.length > 0) {
    const { data: newProvs } = await supabase
      .from('proveedores')
      .insert(missingProvs.map(nombre => ({ nombre, activo: true })))
      .select('id, nombre')
    for (const p of newProvs ?? []) provMap.set(p.nombre.toLowerCase(), p.id as number)
  }

  // ── Código automático: max ART actual ─────────────────────────────────────
  const { data: codigosData } = await supabase.from('articulos').select('codigo').not('codigo', 'is', null)
  let maxArt = 0
  for (const { codigo } of codigosData ?? []) {
    const m = codigo?.match(/^ART(\d+)$/i)
    if (m) maxArt = Math.max(maxArt, parseInt(m[1], 10))
  }

  // ── Insertar artículos y precios ──────────────────────────────────────────
  const errors: { fila: number; nombre: string; error: string }[] = []
  let okCount = 0

  for (let i = 0; i < valid.length; i++) {
    const r = valid[i]
    const nombre = r.nombre.trim()

    let codigo: string | null = r.codigo?.trim() || null
    if (!codigo) {
      maxArt++
      codigo = `ART${String(maxArt).padStart(3, '0')}`
    }

    const categoria_id  = r.categoria?.trim()    ? (catMap.get(r.categoria.trim().toLowerCase()) ?? null)  : null
    const subcategoria_id = r.subcategoria?.trim() && categoria_id
      ? (subMap.get(`${r.subcategoria.trim().toLowerCase()}|${categoria_id}`) ?? null)
      : null
    const marca_id    = r.marca?.trim()     ? (marcaMap.get(r.marca.trim().toLowerCase()) ?? null)   : null
    const proveedor_id = provMap.get(r.proveedor.trim().toLowerCase()) ?? null
    const unidad_id   = r.unidad?.trim()
      ? (unidadMap.get(r.unidad.trim().toLowerCase()) ?? defaultUnidadId)
      : defaultUnidadId

    if (!proveedor_id) {
      errors.push({ fila: i + 2, nombre, error: 'No se pudo resolver el proveedor' })
      continue
    }

    const precio_compra    = r.precio_compra    ?? null
    const precio_venta     = r.precio_venta     ?? null
    const precio_mayorista = r.precio_mayorista ?? null

    const { data: art, error: artErr } = await supabase
      .from('articulos')
      .upsert({
        codigo,
        nombre,
        tipo_articulo: 'simple',
        categoria_id,
        subcategoria_id,
        marca_id,
        proveedor_id,
        unidad_id,
        precio_compra,
        precio_venta,
        activo: true,
      }, { onConflict: 'codigo' })
      .select('id')
      .single()

    if (artErr || !art) {
      errors.push({ fila: i + 2, nombre, error: artErr?.message ?? 'Error desconocido' })
      continue
    }

    const articulo_id = art.id as number
    const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) + 'T00:00:00-03:00'
    const created_by = session.user.id

    // Lista 1 — Compra (siempre manual)
    if (precio_compra != null && precio_compra > 0) {
      const err = await registrarPrecio(
        { articulo_id, lista_precio_id: 1, precio: precio_compra, origen_tipo: 'manual', vigente_desde: ayer, created_by },
        supabase,
      )
      if (err) errors.push({ fila: i + 2, nombre, error: `Precio compra: ${err}` })
    }

    // Lista 2 — Venta
    const lista2 = listaMap.get(2)
    if (precio_venta != null && precio_venta > 0) {
      const err = await registrarPrecio(
        { articulo_id, lista_precio_id: 2, precio: precio_venta, origen_tipo: 'manual', vigente_desde: ayer, created_by },
        supabase,
      )
      if (err) errors.push({ fila: i + 2, nombre, error: `Precio venta: ${err}` })
    } else if (
      lista2?.tipo === 'calculada' && lista2.lista_base_id != null && lista2.porcentaje != null &&
      precio_compra != null && precio_compra > 0
    ) {
      const calculado = calcularPrecioLista(precio_compra, Number(lista2.porcentaje))
      const err = await registrarPrecio(
        { articulo_id, lista_precio_id: 2, precio: calculado, origen_tipo: 'manual', vigente_desde: ayer, created_by },
        supabase,
      )
      if (err) errors.push({ fila: i + 2, nombre, error: `Precio venta calculado: ${err}` })
    }

    // Lista 3 — Mayorista
    const lista3 = listaMap.get(3)
    if (precio_mayorista != null && precio_mayorista > 0) {
      const err = await registrarPrecio(
        { articulo_id, lista_precio_id: 3, precio: precio_mayorista, origen_tipo: 'manual', vigente_desde: ayer, created_by },
        supabase,
      )
      if (err) errors.push({ fila: i + 2, nombre, error: `Precio mayorista: ${err}` })
    } else if (lista3?.tipo === 'calculada' && lista3.lista_base_id != null && lista3.porcentaje != null) {
      const basePrecio = lista3.lista_base_id === 1 ? precio_compra : precio_venta
      if (basePrecio != null && basePrecio > 0) {
        const calculado = calcularPrecioLista(basePrecio, Number(lista3.porcentaje))
        const err = await registrarPrecio(
          { articulo_id, lista_precio_id: 3, precio: calculado, origen_tipo: 'manual', vigente_desde: ayer, created_by },
          supabase,
        )
        if (err) errors.push({ fila: i + 2, nombre, error: `Precio mayorista calculado: ${err}` })
      }
    }

    okCount++
  }

  return NextResponse.json({ ok: okCount, errors })
}
