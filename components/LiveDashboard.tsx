'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Stats = { videos: number; clips: number; queue: number; done: number; failed: number }
type Event = { id: string; icon: string; text: string; sub: string; time: string; color: string }

const REFRESH_MS = 8000

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `hace ${diff}s`
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  return `hace ${Math.floor(diff / 3600)}h`
}

function StatCard({ label, value, color, flash }: { label: string; value: number; color: string; flash: boolean }) {
  return (
    <div className={`bg-surface border rounded-xl p-4 transition-all duration-300 ${flash ? 'border-gold shadow-[0_0_12px_rgba(212,175,55,0.3)]' : 'border-border'}`}>
      <div className={`text-3xl font-bold font-mono transition-all duration-500 ${color} ${flash ? 'scale-110' : 'scale-100'}`}
           style={{ display: 'inline-block' }}>
        {value}
      </div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  )
}

export default function LiveDashboard({ initialStats }: { initialStats: Stats }) {
  const [stats, setStats] = useState(initialStats)
  const [events, setEvents] = useState<Event[]>([])
  const [botActive, setBotActive] = useState(false)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [flash, setFlash] = useState<Record<string, boolean>>({})
  const prevStats = useRef(initialStats)

  const triggerFlash = (keys: string[]) => {
    setFlash(f => { const n = { ...f }; keys.forEach(k => { n[k] = true }); return n })
    setTimeout(() => setFlash(f => { const n = { ...f }; keys.forEach(k => { n[k] = false }); return n }), 1200)
  }

  const poll = useCallback(async () => {
    const sb = createClient()
    const [vids, clips, queue, done, failed, recentClips, recentUploads] = await Promise.all([
      sb.from('videos').select('id', { count: 'exact', head: true }),
      sb.from('clips').select('id', { count: 'exact', head: true }),
      sb.from('clips').select('id', { count: 'exact', head: true }).in('status', ['ready', 'approved']),
      sb.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'done'),
      sb.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      sb.from('clips').select('id,hook,status,created_at,videos(title)').order('created_at', { ascending: false }).limit(8),
      sb.from('uploads').select('id,platform,status,uploaded_at').order('id', { ascending: false }).limit(8),
    ])

    const next: Stats = {
      videos: vids.count ?? 0,
      clips: clips.count ?? 0,
      queue: queue.count ?? 0,
      done: done.count ?? 0,
      failed: failed.count ?? 0,
    }

    const changed = (Object.keys(next) as (keyof Stats)[]).filter(k => next[k] !== prevStats.current[k])
    if (changed.length > 0) {
      triggerFlash(changed)
      setBotActive(true)
      setLastSeen(new Date().toISOString())
      setTimeout(() => setBotActive(false), 6000)
    }
    prevStats.current = next
    setStats(next)

    const clipEvts: Event[] = (recentClips.data ?? []).map((c: any) => ({
      id: `c${c.id}`,
      icon: c.status === 'done' ? '✅' : c.status === 'failed' ? '❌' : '✂️',
      text: c.hook ?? 'Clip creado',
      sub: (c.videos as any)?.title ?? '',
      time: c.created_at,
      color: c.status === 'done' ? 'text-green-400' : c.status === 'failed' ? 'text-red-400' : 'text-purple-400',
    }))

    const uploadEvts: Event[] = (recentUploads.data ?? []).map((u: any) => ({
      id: `u${u.id}`,
      icon: u.status === 'done' ? '✅' : u.status === 'failed' ? '❌' : '📤',
      text: u.status === 'done' ? `Publicado en ${u.platform}` : u.status === 'failed' ? `Error en ${u.platform}` : `Subiendo a ${u.platform}...`,
      sub: '',
      time: u.uploaded_at ?? new Date().toISOString(),
      color: u.status === 'done' ? 'text-green-400' : u.status === 'failed' ? 'text-red-400' : 'text-blue-400',
    }))

    const all = [...clipEvts, ...uploadEvts]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 20)
    setEvents(all)
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, REFRESH_MS)
    return () => clearInterval(id)
  }, [poll])

  const cards = [
    { key: 'videos', label: 'Videos detectados', value: stats.videos, color: 'text-blue-400' },
    { key: 'clips',  label: 'Clips creados',     value: stats.clips,  color: 'text-purple-400' },
    { key: 'queue',  label: 'En cola',            value: stats.queue,  color: 'text-gold' },
    { key: 'done',   label: 'Publicados',         value: stats.done,   color: 'text-green-400' },
    { key: 'failed', label: 'Fallidos',           value: stats.failed, color: 'text-red-400' },
  ]

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inicio</h1>
          <p className="text-muted text-sm">Resumen en tiempo real</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-500 ${
          botActive ? 'bg-green-400/15 text-green-400 border border-green-400/30' : 'bg-surface border border-border text-muted'
        }`}>
          <span className={`w-2 h-2 rounded-full ${botActive ? 'bg-green-400 animate-pulse' : 'bg-muted'}`} />
          {botActive ? 'Bot activo' : lastSeen ? `Último ciclo ${timeAgo(lastSeen)}` : 'Bot inactivo'}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {cards.map(c => (
          <StatCard key={c.key} label={c.label} value={c.value} color={c.color} flash={!!flash[c.key]} />
        ))}
      </div>

      {/* Activity feed */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Actividad en vivo</h2>
        <span className="text-xs text-muted">Actualiza cada {REFRESH_MS / 1000}s</span>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {events.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-3xl mb-3">⏳</div>
            <div className="text-muted text-sm">Esperando actividad del bot...</div>
            <div className="text-dim text-xs mt-1">Corre <code className="bg-surface2 px-1 rounded">python main.py run</code> para iniciar</div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {events.map(ev => (
              <div key={ev.id} className="flex items-start gap-3 p-3 hover:bg-surface2 transition-colors">
                <span className="text-lg leading-none mt-0.5">{ev.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${ev.color}`}>{ev.text}</div>
                  {ev.sub && <div className="text-xs text-muted truncate">{ev.sub}</div>}
                </div>
                <span className="text-xs text-dim whitespace-nowrap shrink-0">{timeAgo(ev.time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
