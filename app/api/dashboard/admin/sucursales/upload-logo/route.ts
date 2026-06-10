import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { NextResponse } from 'next/server'

const BUCKET = 'sucursales'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'Administrador')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await getTenantClient(session)
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: 'Formato no permitido. Usá JPG, PNG, WebP o SVG.' }, { status: 400 })

  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true })
  }

  const ext = file.name.split('.').pop() ?? 'png'
  const fileName = `logo-${Date.now()}.${ext}`
  const bytes = await file.arrayBuffer()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, Buffer.from(bytes), { contentType: file.type, upsert: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return NextResponse.json({ url: publicUrl })
}
