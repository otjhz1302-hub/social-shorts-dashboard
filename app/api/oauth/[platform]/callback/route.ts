import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { PROVIDERS, redirectUri } from '@/lib/oauth'

export const dynamic = 'force-dynamic'

// The platform sends the user back here with ?code&state → exchange, save, back to "Mis redes"
export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const { platform } = params
  const back = (q: string, msg: string) => {
    const res = NextResponse.redirect(new URL(`/dashboard/connections?${q}=${encodeURIComponent(msg)}`, req.url))
    res.cookies.delete(`oauth_${platform}`)
    return res
  }
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))
  const p = PROVIDERS[platform]
  if (!p) return back('error', 'Plataforma desconocida')

  const q = req.nextUrl.searchParams
  if (q.get('error')) return back('error', q.get('error_description') || q.get('error_reason') || q.get('error')!)
  const code = q.get('code')
  const state = req.cookies.get(`oauth_${platform}`)?.value
  if (!code || !state || state !== q.get('state')) return back('error', 'La conexión expiró o no es válida, inténtalo de nuevo')

  try {
    const t = await p.exchange(code, redirectUri(req.nextUrl.origin, platform))
    const now = new Date().toISOString()
    const { error } = await createAdminClient().from('social_connections').upsert(
      { user_id: user.id, platform, ...t, connected_at: now, updated_at: now }, { onConflict: 'user_id,platform' })
    if (error) throw new Error(error.message)
    return back('ok', `${p.label} conectado${t.account_name ? `: ${t.account_name}` : ''}`)
  } catch (e) {
    return back('error', `${p.label}: ${(e as Error).message}`)
  }
}
