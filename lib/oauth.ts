// "Mis redes": OAuth per platform. Tokens are stored server-side in social_connections
// (service role) and read by the bot (core/connections.py) to publish to the guest's accounts.
// Each app's client id/secret must be the same ones the bot has in its .env (the bot refreshes the tokens).

export type Tokens = {
  account_id: string; account_name: string; access_token: string
  refresh_token?: string | null; expires_at?: string | null; scopes?: string | null
}
type Provider = {
  label: string
  authUrl: (redirect: string, state: string) => string
  exchange: (code: string, redirect: string) => Promise<Tokens>
}

const env = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`Falta ${k} en las variables de entorno del dashboard`)
  return v
}
const inSecs = (s?: number) => (s ? new Date(Date.now() + s * 1000).toISOString() : null)
const url = (base: string, q: Record<string, string>) => `${base}?${new URLSearchParams(q)}`

async function call(res: Promise<Response>) {
  const r = await res
  const b = await r.json().catch(() => ({}))
  const err = b.error && !(typeof b.error === 'object' && b.error.code === 'ok') ? b.error : null   // TikTok sends error.code 'ok'
  if (!r.ok || err) throw new Error(b.error_description || err?.message || (typeof err === 'string' ? err : '') || `HTTP ${r.status}`)
  return b
}
const form = (u: string, body: Record<string, string>) =>
  call(fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) }))
const bearer = (u: string, token: string) => call(fetch(u, { headers: { Authorization: `Bearer ${token}` } }))

const FB = 'https://graph.facebook.com/v21.0'

type Page = { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }

// Facebook Login code → long-lived user token → the Pages the user picked. Page tokens derived from
// a long-lived user token don't expire, so neither Facebook nor Instagram connections need refreshing.
async function fbPages(code: string, redirect_uri: string, fields: string): Promise<Page[]> {
  const id = env('FACEBOOK_APP_ID'), secret = env('FACEBOOK_APP_SECRET')
  const short = await call(fetch(url(`${FB}/oauth/access_token`, { client_id: id, client_secret: secret, redirect_uri, code })))
  const long = await call(fetch(url(`${FB}/oauth/access_token`, {
    grant_type: 'fb_exchange_token', client_id: id, client_secret: secret, fb_exchange_token: short.access_token,
  })))
  return (await call(fetch(url(`${FB}/me/accounts`, { fields, access_token: long.access_token })))).data ?? []
}

export const PROVIDERS: Record<string, Provider> = {
  youtube: {
    label: 'YouTube',
    authUrl: (redirect_uri, state) => url('https://accounts.google.com/o/oauth2/v2/auth', {
      client_id: env('GOOGLE_CLIENT_ID'), redirect_uri, state, response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly ' +
             'https://www.googleapis.com/auth/youtube.force-ssl',   // force-ssl: the bot posts the hook comment
      access_type: 'offline', prompt: 'consent',   // consent → Google always returns a refresh token
    }),
    async exchange(code, redirect_uri) {
      const t = await form('https://oauth2.googleapis.com/token', {
        code, redirect_uri, grant_type: 'authorization_code',
        client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'),
      })
      const ch = (await bearer('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', t.access_token)).items?.[0]
      if (!ch) throw new Error('Esa cuenta de Google no tiene canal de YouTube')
      return { account_id: ch.id, account_name: ch.snippet?.title ?? '', access_token: t.access_token,
               refresh_token: t.refresh_token, expires_at: inSecs(t.expires_in), scopes: t.scope }
    },
  },

  // Instagram API with Facebook Login: the professional Instagram account linked to one of the guest's
  // Facebook Pages. Same Meta app as Facebook (no extra keys); the bot publishes with that Page's token.
  instagram: {
    label: 'Instagram',
    authUrl: (redirect_uri, state) => url('https://www.facebook.com/v21.0/dialog/oauth', {
      client_id: env('FACEBOOK_APP_ID'), redirect_uri, state, response_type: 'code',
      scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management',
    }),
    async exchange(code, redirect_uri) {
      const page = (await fbPages(code, redirect_uri, 'id,name,access_token,instagram_business_account{id,username}'))
        .find(p => p.instagram_business_account)
      if (!page?.instagram_business_account)
        throw new Error('Ninguna Página que elegiste tiene una cuenta de Instagram profesional vinculada')
      const ig = page.instagram_business_account
      return { account_id: ig.id, account_name: ig.username ?? page.name, access_token: page.access_token, expires_at: null }
    },
  },

  facebook: {
    label: 'Facebook',
    authUrl: (redirect_uri, state) => url('https://www.facebook.com/v21.0/dialog/oauth', {
      client_id: env('FACEBOOK_APP_ID'), redirect_uri, state, response_type: 'code',
      scope: 'pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts,pages_manage_engagement',
    }),
    async exchange(code, redirect_uri) {
      // ponytail: first Page only; add a Page picker when guests manage several Pages.
      const page = (await fbPages(code, redirect_uri, 'id,name,access_token'))[0]
      if (!page) throw new Error('No administras ninguna Página de Facebook (o no la seleccionaste al conectar)')
      return { account_id: page.id, account_name: page.name, access_token: page.access_token, expires_at: null }
    },
  },

  // Content Posting API, upload mode: clips land in the TikTok inbox as drafts
  tiktok: {
    label: 'TikTok',
    authUrl: (redirect_uri, state) => url('https://www.tiktok.com/v2/auth/authorize/', {
      client_key: env('TIKTOK_CLIENT_KEY'), redirect_uri, state, response_type: 'code', scope: 'user.info.basic,video.upload',
    }),
    async exchange(code, redirect_uri) {
      const t = await form('https://open.tiktokapis.com/v2/oauth/token/', {
        code, redirect_uri, grant_type: 'authorization_code',
        client_key: env('TIKTOK_CLIENT_KEY'), client_secret: env('TIKTOK_CLIENT_SECRET'),
      })
      const u = (await bearer('https://open.tiktokapis.com/v2/user/info/?fields=display_name', t.access_token)).data?.user
      return { account_id: t.open_id, account_name: u?.display_name ?? '', access_token: t.access_token,
               refresh_token: t.refresh_token, expires_at: inSecs(t.expires_in), scopes: t.scope }
    },
  },
}

export const redirectUri = (origin: string, platform: string) => `${origin}/api/oauth/${platform}/callback`
