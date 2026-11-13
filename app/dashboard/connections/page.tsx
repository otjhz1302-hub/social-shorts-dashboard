import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { PROVIDERS } from '@/lib/oauth'

export const dynamic = 'force-dynamic'

const NOTES: Record<string, string> = {
  youtube:   'Se publica como Short en tu canal.',
  instagram: 'Cuenta profesional (Creador o Empresa) vinculada a tu Página de Facebook. Se publica como Reel.',
  facebook:  'Se publica como video en tu Página.',
  tiktok:    'Llega a tu bandeja de TikTok como borrador: ábrelo en la app y publícalo.',
}

async function disconnect(form: FormData) {
  'use server'
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) redirect('/login')
  await createAdminClient().from('social_connections').delete()
    .eq('user_id', user.id).eq('platform', String(form.get('platform')))
  revalidatePath('/dashboard/connections')
}

export default async function ConnectionsPage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) redirect('/login')
  // Only non-secret columns: tokens never leave the server
  const { data, error } = await createAdminClient().from('social_connections')
    .select('platform,account_name,connected_at').eq('user_id', user.id)
  const mine: Record<string, { account_name: string; connected_at: string }> = {}
  for (const c of data ?? []) mine[c.platform] = c

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Mis redes</h1>
      <p className="text-muted text-sm mb-6">
        Conecta tus cuentas: los cortes que pidas en «Cortes» se publican en ellas (nunca en la plataforma de donde viene el video).
      </p>

      {searchParams.ok && <div className="mb-4 rounded-lg border border-green-400/30 bg-green-400/10 text-green-400 text-sm p-3">{searchParams.ok}</div>}
      {searchParams.error && <div className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 text-red-400 text-sm p-3">{searchParams.error}</div>}
      {error && <div className="mb-4 rounded-lg border border-gold/30 bg-gold/10 text-gold text-sm p-3">Falta ejecutar supabase/schema_marketplace.sql en Supabase.</div>}

      <div className="flex flex-col gap-3">
        {Object.entries(PROVIDERS).map(([key, p]) => {
          const c = mine[key]
          return (
            <div key={key} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{p.label}</div>
                <div className="text-xs text-muted mt-0.5">
                  {c ? <>Conectado{c.account_name ? <> como <span className="text-white">{c.account_name}</span></> : ''} · {new Date(c.connected_at).toLocaleDateString('es')}</> : NOTES[key]}
                </div>
              </div>
              {c ? (
                <div className="flex gap-2">
                  <a href={`/api/oauth/${key}`} className="text-xs px-3 py-2 rounded-lg border border-border text-muted hover:text-white">Reconectar</a>
                  <form action={disconnect}>
                    <input type="hidden" name="platform" value={key} />
                    <button className="text-xs px-3 py-2 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10">Desconectar</button>
                  </form>
                </div>
              ) : (
                <a href={`/api/oauth/${key}`} className="text-xs font-semibold px-4 py-2 rounded-lg bg-gold/15 text-gold border border-gold/40 hover:bg-gold/25">Conectar</a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
