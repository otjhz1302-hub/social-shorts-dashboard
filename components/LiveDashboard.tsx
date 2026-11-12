'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Stats = {
  videos: number; clips: number; queue: number
  done: number; failed: number; today: number; monitored: number
}
type LogEntry = {
  id: number; icon: string; message: string; detail: string
  level: string; created_at: string
}
type BotStatus = { is_running: boolean; last_seen: string; current_task: string }

const REFRESH_MS = 5000  // 5s polling for snappy dashboard

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 5)  return 'ahora mismo'
  if (diff < 60) return `hace ${diff}s`
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  return `hace ${Math.floor(diff / 3600)}h`
}

function StatCard({ label, value, color, flash, sub }: {
  label: string; value: number | string; color: string; flash: boolean; sub?: string
}) {
  return (
    <div className={`bg-surface border rounded-xl p-4 transition-all duration-300 ${
      flash ? 'border-gold shadow-[0_0_16px_rgba(212,175,55,0.35)]' : 'border-border'
    }`}>
      <div className={`text-3xl font-bold font-mono transition-transform duration-300 ${color} ${
        flash ? 'scale-110' : 'scale-100'
      }`} style={{ display: 'inline-block' }}>{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
      {sub && <div className="text-[10px] text-dim mt-0.5">{sub}</div>}
    </div>
  )
}

function LevelDot({ level }: { level: string }) {
  const map: Record<string, string> = {
    success: 'bg-green-400',
    error:   'bg-red-400',
    warning: 'bg-yellow-400',
    info:    'bg-blue-400',
  }
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${map[level] ?? 'bg-muted'}`} />
}

export default function LiveDashboard({ initialStats }: { initialStats: Stats }) {
  const [stats,     setStats]     = useState(initialStats)
  const [logs,      setLogs]      = useState<LogEntry[]>([])
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const [flash,     setFlash]     = useState<Record<string, boolean>>({})
  const prevStats = useRef(initialStats)

  const triggerFlash = (keys: string[]) => {
    setFlash(f => { const n = {...f}; keys.forEach(k => { n[k] = true }); return n })
    setTimeout(() => setFlash(f => { const n = {...f}; keys.forEach(k => { n[k] = false }); return n }), 1400)
  }

  const poll = useCallback(async () => {
    const sb = createClient()
    const [
      vids, clips, queue, done, failed,
      logsRes, statusRes, quotaRes, monitoredRes,
    ] = await Promise.all([
      sb.from('videos').select('id', { count: 'exact', head: true }),
      sb.from('clips').select('id', { count: 'exact', head: true }),
      sb.from('clips').select('id', { count: 'exact', head: true }).in('status', ['ready','approved','queued']),
      sb.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'done'),
      sb.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      sb.from('bot_logs').select('id,icon,message,detail,level,created_at').order('id', { ascending: false }).limit(30),
      sb.from('bot_status').select('is_running,last_seen,current_task').eq('id', 1).single(),
      sb.from('daily_quota').select('count').eq('date', new Date().toISOString().slice(0,10)).single(),
      sb.from('streamers').select('id', { count: 'exact', head: true }).eq('is_monitored', true),
    ])

    const next: Stats = {
      videos:    vids.count    ?? 0,
      clips:     clips.count   ?? 0,
      queue:     queue.count   ?? 0,
      done:      done.count    ?? 0,
      failed:    failed.count  ?? 0,
      today:     (quotaRes.data as any)?.count ?? 0,
      monitored: monitoredRes.count ?? 0,
    }

    const changed = (Object.keys(next) as (keyof Stats)[]).filter(k => next[k] !== prevStats.current[k])
    if (changed.length > 0) triggerFlash(changed)
    prevStats.current = next
    setStats(next)

    setLogs(logsRes.data as LogEntry[] ?? [])

    if (statusRes.data) {
      setBotStatus(statusRes.data as BotStatus)
    }
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, REFRESH_MS)
    return () => clearInterval(id)
  }, [poll])

  // Bot is active if last_seen < 3 minutes ago
  const isActive = botStatus
    ? (Date.now() - new Date(botStatus.last_seen).getTime()) < 3 * 60 * 1000
    : false

  const cards = [
    { key: 'videos',    label: 'Videos detectados',  value: stats.videos,    color: 'text-blue-400' },
    { key: 'clips',     label: 'Clips creados',       value: stats.clips,     color: 'text-purple-400' },
    { key: 'today',     label: 'Publicados hoy',      value: `${stats.today}/7`, color: 'text-gold', sub: 'quota diaria' },
    { key: 'done',      label: 'Total publicados',    value: stats.done,      color: 'text-green-400' },
    { key: 'queue',     label: 'En cola',             value: stats.queue,     color: 'text-yellow-400' },
    { key: 'monitored', label: 'Streamers seguidos',  value: stats.monitored, color: 'text-pink-400' },
    { key: 'failed',    label: 'Fallidos',            value: stats.failed,    color: 'text-red-400' },
  ]

  return (
    <div className="p-6 max-w-6xl">

      {/* Header + bot status */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Content Factory</h1>
          <p className="text-muted text-sm">Actualiza cada {REFRESH_MS / 1000}s</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-500 ${
          isActive
            ? 'bg-green-400/15 text-green-400 border border-green-400/40'
            : 'bg-surface border border-border text-muted'
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'}`} />
          {isActive ? (
            <span>Bot activo — {botStatus?.current_task ?? 'trabajando'}</span>
          ) : botStatus?.last_seen ? (
            <span>Bot inactivo · último ciclo {timeAgo(botStatus.last_seen)}</span>
          ) : (
            <span>Bot inactivo · ejecuta <code className="bg-surface2 px-1 rounded">python scheduler.py</code></span>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {cards.map(c => (
          <StatCard key={c.key} label={c.label} value={c.value} color={c.color}
                    flash={!!flash[c.key]} sub={(c as any).sub} />
        ))}
      </div>

      {/* Activity log */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Log en vivo</h2>
        <span className="text-xs text-dim">{logs.length} entradas recientes</span>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden font-mono text-xs">
        {logs.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-3xl mb-3">🤖</div>
            <div className="text-muted">Esperando actividad del bot...</div>
            <div className="text-dim mt-2">
              Ejecuta: <code className="bg-surface2 px-2 py-0.5 rounded">python scheduler.py</code>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/30 max-h-[500px] overflow-y-auto">
            {logs.map(entry => (
              <div key={entry.id} className={`flex items-start gap-2 px-4 py-2.5 hover:bg-surface2 transition-colors ${
                entry.level === 'error'   ? 'border-l-2 border-red-500/60' :
                entry.level === 'success' ? 'border-l-2 border-green-500/40' :
                entry.level === 'warning' ? 'border-l-2 border-yellow-500/40' : ''
              }`}>
                <LevelDot level={entry.level} />
                <span className="text-base leading-none shrink-0">{entry.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className={`${
                    entry.level === 'error'   ? 'text-red-400' :
                    entry.level === 'success' ? 'text-green-400' :
                    entry.level === 'warning' ? 'text-yellow-400' : 'text-foreground'
                  }`}>{entry.message}</span>
                  {entry.detail && (
                    <div className="text-dim text-[10px] mt-0.5 truncate">{entry.detail}</div>
                  )}
                </div>
                <span className="text-dim whitespace-nowrap shrink-0">{timeAgo(entry.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
