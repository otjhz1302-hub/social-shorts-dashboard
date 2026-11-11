import { createClient } from '@/lib/supabase/server'
import ApproveButtons from './ApproveButtons'

export default async function QueuePage() {
  const supabase = createClient()
  const { data: clips } = await supabase
    .from('clips')
    .select('*, videos(title, channel)')
    .eq('status', 'ready')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Cola de aprobación</h1>
      <p className="text-muted text-sm mb-6">
        Clips listos para publicar. Revisa y aprueba o rechaza cada uno.
      </p>

      {(!clips || clips.length === 0) ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">⬡</div>
          <div className="text-muted">No hay clips en cola por ahora.</div>
          <div className="text-dim text-sm mt-1">El scheduler agregará clips automáticamente.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {clips.map((clip: any) => (
            <div key={clip.id} className="bg-surface border border-border rounded-xl p-4 flex gap-4 items-start">
              {clip.thumbnail_url ? (
                <img
                  src={clip.thumbnail_url} alt="thumbnail"
                  className="w-24 h-16 object-cover rounded-lg shrink-0 bg-surface2"
                />
              ) : (
                <div className="w-24 h-16 rounded-lg bg-surface2 shrink-0 flex items-center justify-center text-dim text-xs">
                  Sin thumb
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm mb-1 truncate">{clip.hook || 'Sin hook'}</div>
                <div className="text-muted text-xs mb-1 truncate">
                  {(clip.videos as any)?.title ?? '—'} · {(clip.videos as any)?.channel ?? '—'}
                </div>
                <div className="text-dim text-xs">
                  {clip.start_sec?.toFixed(1)}s → {clip.end_sec?.toFixed(1)}s
                  ({((clip.end_sec ?? 0) - (clip.start_sec ?? 0)).toFixed(0)}s)
                </div>
              </div>
              <ApproveButtons clipId={clip.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
