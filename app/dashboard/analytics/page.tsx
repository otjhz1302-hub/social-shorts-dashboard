import { createClient } from '@/lib/supabase/server'

export default async function AnalyticsPage() {
  const supabase = createClient()

  const [{ data: byPlatform }, { data: byDay }] = await Promise.all([
    supabase.from('uploads').select('platform, status'),
    supabase.from('uploads')
      .select('uploaded_at, status')
      .eq('status', 'done')
      .order('uploaded_at', { ascending: false })
      .limit(90),
  ])

  // Agrupar por plataforma
  const platformStats = (byPlatform ?? []).reduce((acc: Record<string, { done: number, failed: number }>, u: any) => {
    if (!acc[u.platform]) acc[u.platform] = { done: 0, failed: 0 }
    if (u.status === 'done') acc[u.platform].done++
    if (u.status === 'failed') acc[u.platform].failed++
    return acc
  }, {})

  const platforms = Object.entries(platformStats)
  const maxVal = Math.max(...platforms.map(([, v]) => v.done + v.failed), 1)

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Analíticas</h1>
      <p className="text-muted text-sm mb-8">Rendimiento de publicaciones por plataforma</p>

      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Por plataforma</h2>
      <div className="flex flex-col gap-3 mb-10">
        {platforms.length === 0 ? (
          <div className="text-muted text-sm">Sin datos aún.</div>
        ) : platforms.map(([platform, stats]) => (
          <div key={platform} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium capitalize">{platform}</span>
              <div className="flex gap-3 text-xs">
                <span className="text-green-400">{stats.done} OK</span>
                <span className="text-red-400">{stats.failed} fail</span>
              </div>
            </div>
            <div className="h-2 bg-surface2 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold rounded-full"
                style={{ width: `${(stats.done / maxVal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-4">Últimas 20 publicaciones exitosas</h2>
        {(!byDay || byDay.length === 0) ? (
          <div className="text-muted text-sm">Sin publicaciones aún.</div>
        ) : (
          <div className="text-xs text-muted">
            {byDay.slice(0, 20).map((u: any, i: number) => (
              <div key={i} className="py-1 border-b border-border/40 last:border-0">
                {u.uploaded_at ? new Date(u.uploaded_at).toLocaleString('es') : '—'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
