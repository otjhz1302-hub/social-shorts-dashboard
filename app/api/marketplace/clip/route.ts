import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// "Crear corte": request_guest_clip checks niche, connected accounts, duplicates and the daily quota atomically
export async function POST(req: Request) {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { discovery_id } = await req.json().catch(() => ({}))
  if (!Number.isInteger(discovery_id)) return NextResponse.json({ error: 'discovery_id inválido' }, { status: 400 })

  const { data, error } = await createAdminClient().rpc('request_guest_clip', { p_user: user.id, p_discovery: discovery_id })
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  return NextResponse.json({ ok: true, job_id: data })
}
