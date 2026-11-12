import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { budgetSnapshot } from '@/lib/searchBudget'

export const dynamic = 'force-dynamic'

async function currentUser() {
  const { data: { user } } = await createClient().auth.getUser()
  return user
}

// Any signed-in user: own budget. Admins also get every actor's usage and the user list.
export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const admin = createAdminClient()
  const snap = await budgetSnapshot(admin, user.id)
  if (!snap.isAdmin) {
    return NextResponse.json({ limits: snap.limits, total: snap.total, cap: snap.cap, mine: snap.mine,
      remaining: snap.remaining, hasPending: snap.hasPending, isAdmin: false, tablesMissing: snap.tablesMissing })
  }
  const { data: users } = await admin.from('profiles').select('id,email,role,search_daily_limit').order('created_at')
  return NextResponse.json({ ...snap, users: users ?? [] })
}

const intOrNull = (v: unknown, max = 1000) =>
  v === null ? null : Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : undefined

// Admin only: { daily_total, bot_daily, guest_daily } or { user_id, search_daily_limit }
export async function POST(req: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const admin = createAdminClient()
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Solo los admins pueden cambiar el presupuesto' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (typeof body.user_id === 'string') {
    const limit = intOrNull(body.search_daily_limit)
    if (limit === undefined) return NextResponse.json({ error: 'Límite inválido (0–1000 o vacío)' }, { status: 400 })
    const { error } = await admin.from('profiles').update({ search_daily_limit: limit }).eq('id', body.user_id)
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true })
  }

  const fields: Record<string, number> = {}
  for (const k of ['daily_total', 'bot_daily', 'guest_daily'] as const) {
    if (body[k] === undefined) continue
    const v = intOrNull(body[k], 100)
    if (v === undefined || v === null) return NextResponse.json({ error: `${k} debe ser un entero entre 0 y 100` }, { status: 400 })
    fields[k] = v
  }
  const { error } = await admin.from('search_limits')
    .upsert({ id: 1, ...fields, updated_at: new Date().toISOString() })
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true })
}
