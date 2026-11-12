import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// The bot's on/off switch. The bot (on the admin's PC) reads bot_status.enabled every ~15 s:
// off = no searches, captures, edits or publishing; it keeps its heartbeat so the dashboard sees it.
async function admin() {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return null
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return data?.role === 'admin' ? db : null
}

export async function GET() {
  const db = await admin()
  if (!db) return NextResponse.json({ error: 'Solo el admin' }, { status: 403 })
  const { data, error } = await db.from('bot_status').select('enabled,is_running,last_seen,current_task').eq('id', 1).maybeSingle()
  if (error) return NextResponse.json({ error: 'Falta ejecutar supabase/schema_control.sql' }, { status: 503 })
  return NextResponse.json(data ?? {})
}

export async function POST(req: Request) {
  const db = await admin()
  if (!db) return NextResponse.json({ error: 'Solo el admin' }, { status: 403 })
  const { enabled } = await req.json().catch(() => ({}))
  if (typeof enabled !== 'boolean') return NextResponse.json({ error: 'enabled debe ser true o false' }, { status: 400 })
  const { error } = await db.from('bot_status').upsert({ id: 1, enabled })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, enabled })
}
