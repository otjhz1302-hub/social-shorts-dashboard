import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import Marketplace from '@/components/Marketplace'

export const dynamic = 'force-dynamic'

export default async function MarketplacePage() {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) redirect('/login')
  const admin = createAdminClient()
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString()

  const [niches, picks, conns, jobs, prof, lim] = await Promise.all([
    admin.from('niches').select('id,name,keywords').order('name'),
    admin.from('user_niches').select('niche_id').eq('user_id', user.id),
    admin.from('social_connections').select('platform').eq('user_id', user.id),
    admin.from('pipeline_jobs').select('id,discovery_id,source_id,source_title,stage,message,progress,published,created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    admin.from('profiles').select('role,publish_daily_limit').eq('id', user.id).maybeSingle(),
    admin.from('search_limits').select('guest_publish_daily').eq('id', 1).maybeSingle(),
  ])
  if (picks.error) return (
    <div className="p-6"><div className="rounded-lg border border-gold/30 bg-gold/10 text-gold text-sm p-4">
      Falta ejecutar supabase/schema_marketplace.sql en Supabase (SQL Editor → Run).
    </div></div>
  )

  const picked = (picks.data ?? []).map((p: { niche_id: number }) => p.niche_id)
  const { data: discoveries } = picked.length
    ? await admin.from('discoveries')
        .select('id,niche_id,kind,source_id,source_url,title,channel,views,duration,viral_score,hook,found_at,payload')
        .in('niche_id', picked).is('claimed_by', null)   // taken by a guest → gone for everyone else
        .gt('expires_at', new Date().toISOString())
        .order('viral_score', { ascending: false }).limit(60)
    : { data: [] }

  const myJobs = jobs.data ?? []
  const isAdmin = prof.data?.role === 'admin'
  const cap: number | null = isAdmin ? null : (prof.data?.publish_daily_limit ?? lim.data?.guest_publish_daily ?? 3)
  const used = myJobs.filter((j: { stage: string; created_at: string }) => j.stage !== 'failed' && j.created_at > since).length

  return (
    <Marketplace
      niches={niches.data ?? []} picked={picked} discoveries={discoveries ?? []} jobs={myJobs}
      platforms={(conns.data ?? []).map((c: { platform: string }) => c.platform)}
      quota={{ cap, used }}
    />
  )
}
