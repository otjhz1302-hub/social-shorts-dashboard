import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const NETWORKS = ['youtube', 'instagram', 'facebook', 'tiktok']
const fail = (error: string, status: number) => NextResponse.json({ error }, { status })

// «Publicar»: queue a finished short for the bot to upload right away to the networks the user ticked,
// with that user's own accounts («Mis redes»). Admins can publish any short; guests only their own.
export async function POST(req: Request) {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return fail('No autenticado', 401)
  const body = await req.json().catch(() => ({}))
  const platforms: string[] = Array.isArray(body.platforms) ? Array.from(new Set(body.platforms)) : []
  if (!Number.isInteger(body.job_id) || !platforms.length || platforms.some(p => !NETWORKS.includes(p)))
    return fail('Pedido inválido', 400)

  const admin = createAdminClient()
  const [job, prof, conns] = await Promise.all([
    admin.from('pipeline_jobs').select('id,user_id,clip_id,stage,published').eq('id', body.job_id).maybeSingle(),
    admin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    admin.from('social_connections').select('platform').eq('user_id', user.id),
  ])
  if (!job.data) return fail('Ese short no existe', 404)
  if (job.data.user_id !== user.id && prof.data?.role !== 'admin') return fail('Solo puedes publicar tus propios cortes', 403)
  if (!job.data.clip_id || !['ready', 'published'].includes(job.data.stage)) return fail('El short aún no está terminado', 409)

  const connected = new Set((conns.data ?? []).map((c: { platform: string }) => c.platform))
  const missing = platforms.filter(p => !connected.has(p))
  if (missing.length) return fail(`Conecta ${missing.join(', ')} en «Mis redes»`, 409)
  const already = platforms.filter(p => (job.data.published ?? {})[p])
  if (already.length) return fail(`Ya está publicado en ${already.join(', ')}`, 409)

  const { error } = await admin.from('publish_requests').insert({ job_id: body.job_id, user_id: user.id, platforms })
  if (error) return fail(error.code === '23505' ? 'Ya hay una publicación en curso para este short'
    : ['42P01', 'PGRST205'].includes(error.code) ? 'Falta ejecutar supabase/schema_publish.sql en Supabase' : error.message, 409)
  return NextResponse.json({ ok: true })
}
