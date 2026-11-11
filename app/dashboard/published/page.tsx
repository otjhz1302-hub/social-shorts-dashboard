import { createClient } from '@/lib/supabase/server'

const PLATFORM_ICONS: Record<string, string> = {
  youtube: '▶', instagram: '◉', facebook: '◈', tiktok: '◇',
}

export default async function PublishedPage() {
  const supabase = createClient()
  const { data: uploads } = await supabase
    .from('uploads')
    .select('*, clips(hook, thumbnail_url)')
    .order('id', { ascending: false })
    .limit(50)

  const statusStyle: Record<string, string> = {
    done:     'text-green-400 bg-green-400/10 border-green-400/30',
    failed:   'text-red-400 bg-red-400/10 border-red-400/30',
    pending:  'text-muted bg-muted/10 border-muted/30',
    uploading:'text-gold bg-gold/10 border-gold/30',
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Publicados</h1>
      <p className="text-muted text-sm mb-6">Historial de subidas a plataformas</p>

      {(!uploads || uploads.length === 0) ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-muted">
          No hay publicaciones aún.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border text-muted text-xs">
                <th className="text-left p-3">Plataforma</th>
                <th className="text-left p-3">Título</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-left p-3">Enlace</th>
                <th className="text-left p-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(uploads ?? []).map((u: any) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-surface2">
                  <td className="p-3">
                    <span className="font-mono text-gold">{PLATFORM_ICONS[u.platform] ?? '○'}</span>
                    <span className="ml-2 capitalize text-muted">{u.platform}</span>
                  </td>
                  <td className="p-3 max-w-xs truncate">{u.title}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyle[u.status] ?? ''}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {u.platform_url ? (
                      <a href={u.platform_url} target="_blank" rel="noopener noreferrer"
                        className="text-gold hover:underline text-xs">Ver →</a>
                    ) : (
                      <span className="text-dim text-xs">{u.error_msg ? u.error_msg.slice(0, 40) : '—'}</span>
                    )}
                  </td>
                  <td className="p-3 text-muted">
                    {u.uploaded_at ? new Date(u.uploaded_at).toLocaleDateString('es') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
