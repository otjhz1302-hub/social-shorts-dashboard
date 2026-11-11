import { createClient } from '@/lib/supabase/server'

async function getStats(supabase: any) {
  const [videos, clips, queue, done, failed] = await Promise.all([
    supabase.from('videos').select('id', { count: 'exact', head: true }),
    supabase.from('clips').select('id', { count: 'exact', head: true }),
    supabase.from('clips').select('id', { count: 'exact', head: true }).eq('status', 'ready'),
    supabase.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'done'),
    supabase.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  ])
  return {
    videos: videos.count ?? 0,
    clips: clips.count ?? 0,
    queue: queue.count ?? 0,
    done: done.count ?? 0,
    failed: failed.count ?? 0,
  }
}

export default async function DashboardPage() {
  const supabase = createClient()
  const stats = await getStats(supabase)

  const { data: recent } = await supabase
    .from('clips')
    .select('id, hook, status, created_at, videos(title)')
    .order('created_at', { ascending: false })
    .limit(8)

  const cards = [
    { label: 'Videos detectados', value: stats.videos, color: 'text-blue-400' },
    { label: 'Clips creados',     value: stats.clips,  color: 'text-purple-400' },
    { label: 'En cola',           value: stats.queue,  color: 'text-gold' },
    { label: 'Publicados',        value: stats.done,   color: 'text-green-400' },
    { label: 'Fallidos',          value: stats.failed, color: 'text-red-400' },
  ]

  const statusColor: Record<string, string> = {
    ready:    'bg-gold/20 text-gold',
    approved: 'bg-blue-400/20 text-blue-400',
    done:     'bg-green-400/20 text-green-400',
    failed:   'bg-red-400/20 text-red-400',
    pending:  'bg-dim/20 text-muted',
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Inicio</h1>
      <p className="text-muted text-sm mb-6">Resumen del sistema</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {cards.map(c => (
          <div key={c.label} className="bg-surface border border-border rounded-xl p-4">
            <div className={`text-3xl font-bold font-mono ${c.color}`}>{c.value}</div>
            <div className="text-xs text-muted mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <h2 className="text-base font-semibold mb-3">Clips recientes</h2>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {(recent ?? []).length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">
            No hay clips aún. El sistema empezará a detectar videos cuando ejecutes el scheduler.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs">
                <th className="text-left p-3">Hook</th>
                <th className="text-left p-3 hidden md:table-cell">Video fuente</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-left p-3 hidden sm:table-cell">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(recent ?? []).map((c: any) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-surface2">
                  <td className="p-3 max-w-xs truncate">{c.hook || '—'}</td>
                  <td className="p-3 max-w-xs truncate hidden md:table-cell text-muted">
                    {(c.videos as any)?.title ?? '—'}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[c.status] ?? 'bg-dim/20 text-muted'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted hidden sm:table-cell">
                    {new Date(c.created_at).toLocaleDateString('es')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
