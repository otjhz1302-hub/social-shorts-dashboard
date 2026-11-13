import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { budgetSnapshot, COST_PER_REQUEST } from '@/lib/searchBudget'

export const dynamic = 'force-dynamic'

// Latest request of the signed-in user (for the button's status)
export async function GET() {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { data } = await createAdminClient().from('search_requests').select('id,status,found,message,created_at')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return NextResponse.json({ request: data ?? null })
}

// Queue a "search lives now" (or, with {kind:'videos', niche_id}, "search videos in my niche")
// for the bot — only if this user still has budget today
export async function POST(req: Request) {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()
  const extra = body.kind === 'videos' ? { kind: 'videos', niche_id: Number(body.niche_id) } : {}
  if ('niche_id' in extra) {
    const { data: pick } = await admin.from('user_niches').select('niche_id')
      .eq('user_id', user.id).eq('niche_id', extra.niche_id).maybeSingle()
    if (!pick) return NextResponse.json({ error: 'Elige ese nicho primero' }, { status: 403 })
  }
  const snap = await budgetSnapshot(admin, user.id)
  if (snap.tablesMissing)
    return NextResponse.json({ error: 'Falta ejecutar supabase/schema_studio.sql' }, { status: 503 })
  if (snap.hasPending)
    return NextResponse.json({ error: 'Ya tienes una búsqueda en curso' }, { status: 409 })
  if (snap.remaining < COST_PER_REQUEST)
    return NextResponse.json({ error: `Sin búsquedas disponibles hoy (${snap.mine}/${snap.cap})` }, { status: 429 })

  const { error } = await admin.from('search_requests').insert({ user_id: user.id, ...extra })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, remaining: snap.remaining - COST_PER_REQUEST })
}
