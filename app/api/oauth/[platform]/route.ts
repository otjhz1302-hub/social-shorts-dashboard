import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PROVIDERS, redirectUri } from '@/lib/oauth'

export const dynamic = 'force-dynamic'

// "Conectar": send the signed-in user to the platform's consent screen
export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))
  const p = PROVIDERS[params.platform]
  if (!p) return NextResponse.json({ error: 'Plataforma desconocida' }, { status: 404 })

  const state = crypto.randomUUID()
  let target: string
  try {
    target = p.authUrl(redirectUri(req.nextUrl.origin, params.platform), state)
  } catch (e) {
    return NextResponse.redirect(new URL(`/dashboard/connections?error=${encodeURIComponent((e as Error).message)}`, req.url))
  }
  const res = NextResponse.redirect(target)
  res.cookies.set(`oauth_${params.platform}`, state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/',
  })
  return res
}
