'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────
type Stats = {
  videos: number; clips: number; queue: number
  done: number; failed: number; today: number; monitored: number
}
type LogEntry  = { id: number; icon: string; message: string; detail: string; level: string; created_at: string }
type BotStatus = { is_running: boolean; last_seen: string; current_task: string }
type PlatformStat = { total: number; success: number; failed: number; last_upload: string | null }
type Niche = { id: number; name: string; keywords: string[]; min_views: number; min_subscribers: number; is_active: boolean; clip_count: number }

const REFRESH_MS = 4000
const PLATFORMS_CFG = [
  { key: 'youtube',   label: 'YouTube',   icon: '▶', color: '#ff4444',  bg: '#1a0808' },
  { key: 'instagram', label: 'Instagram', icon: '◈', color: '#ff44cc',  bg: '#1a0815' },
  { key: 'facebook',  label: 'Facebook',  icon: '◉', color: '#4488ff',  bg: '#08101a' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function ago(iso: string | null) {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 5)    return 'ahora'
  if (d < 60)   return `${d}s`
  if (d < 3600) return `${Math.floor(d / 60)}m`
  return `${Math.floor(d / 3600)}h`
}

function useCount(target: number) {
  const [v, setV] = useState(target)
  const p = useRef(target)
  useEffect(() => {
    if (p.current === target) return
    const diff = target - p.current; const steps = 18; let i = 0
    const id = setInterval(() => {
      i++; setV(Math.round(p.current + diff * (i / steps)))
      if (i >= steps) { clearInterval(id); p.current = target }
    }, 25)
    return () => clearInterval(id)
  }, [target])
  return v
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CycleCard({ label, value, sub, icon, color, flash }: {
  label: string; value: string | number; sub?: string; icon: string; color: string; flash: boolean
}) {
  return (
    <div style={{
      background: '#080d14', borderRadius: 14, padding: '18px 20px',
      border: `1px solid ${flash ? color : '#1a2235'}`,
      boxShadow: flash ? `0 0 24px ${color}44` : 'none',
      transition: 'all 0.4s', flex: 1,
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'monospace', color,
        textShadow: flash ? `0 0 20px ${color}` : 'none', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#4a5a6a', marginTop: 6, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#2a3a4a', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function PlatformCard({ cfg, stat, isActive }: {
  cfg: typeof PLATFORMS_CFG[0]; stat: PlatformStat; isActive: boolean
}) {
  const rate = stat.total > 0 ? Math.round((stat.success / stat.total) * 100) : 0
  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${stat.success > 0 ? cfg.color + '44' : '#1a2235'}`,
      borderRadius: 14, padding: '20px', flex: 1,
      boxShadow: stat.success > 0 ? `0 0 20px ${cfg.color}22` : 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.color + '22',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: cfg.color, fontWeight: 900, border: `1px solid ${cfg.color}44` }}>
          {cfg.icon}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%',
              background: isActive ? cfg.color : '#2a3a4a',
              boxShadow: isActive ? `0 0 6px ${cfg.color}` : 'none',
              animation: isActive ? 'blink 1.5s infinite' : 'none' }} />
            <span style={{ fontSize: 9, color: isActive ? cfg.color : '#3a4a5a', letterSpacing: 1 }}>
              {isActive ? 'ACTIVO' : 'ESPERANDO'}
            </span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: cfg.color }}>{stat.success}</div>
          <div style={{ fontSize: 9, color: '#3a4a5a', letterSpacing: 1 }}>PUBLICADOS</div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Total', value: stat.total },
          { label: 'Éxito', value: `${rate}%` },
          { label: 'Errores', value: stat.failed },
        ].map(s => (
          <div key={s.label} style={{ background: '#0a1020', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: '#c8d8ff' }}>{s.value}</div>
            <div style={{ fontSize: 9, color: '#3a4a5a', letterSpacing: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Success bar */}
      <div style={{ background: '#0a1020', borderRadius: 4, height: 4, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${rate}%`, background: cfg.color,
          boxShadow: `0 0 8px ${cfg.color}`, borderRadius: 4, transition: 'width 1s ease' }} />
      </div>

      <div style={{ fontSize: 10, color: '#2a3a4a', display: 'flex', justifyContent: 'space-between' }}>
        <span>Último</span>
        <span style={{ color: '#3a5a6a' }}>{ago(stat.last_upload)}</span>
      </div>
    </div>
  )
}

function LogFeed({ logs }: { logs: LogEntry[] }) {
  const colors: Record<string, string> = {
    success: '#00ff88', error: '#ff3366', warning: '#ffaa00', info: '#00aaff'
  }
  return (
    <div style={{ background: '#060b14', border: '1px solid #1a2235', borderRadius: 14, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        background: '#080f1c', borderBottom: '1px solid #1a2235', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ff3366','#ffaa00','#00ff88'].map((c,i) => (
            <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c, opacity: 0.7 }} />
          ))}
        </div>
        <span style={{ fontSize: 10, color: '#3a4a5a', letterSpacing: 2, flex: 1, textAlign: 'center', fontFamily: 'monospace' }}>
          LIVE ACTIVITY LOG
        </span>
        <span style={{ fontSize: 9, color: '#2a3a4a', fontFamily: 'monospace' }}>{logs.length} eventos</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 420 }}>
        {logs.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: '#1a2a3a' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⚡</div>
            <div style={{ letterSpacing: 2, fontSize: 11 }}>ESPERANDO SEÑAL DEL BOT</div>
            <div style={{ fontSize: 10, marginTop: 6, fontFamily: 'monospace', color: '#121c24' }}>$ python scheduler.py</div>
          </div>
        ) : logs.map((e, i) => {
          const c = colors[e.level] ?? '#5a7a9a'
          return (
            <div key={e.id} style={{
              display: 'flex', gap: 8, padding: '7px 14px',
              borderBottom: '1px solid #0d1525',
              background: i === 0 ? '#0a1525' : 'transparent',
              animation: i === 0 ? 'fadeIn 0.3s ease-out' : 'none',
            }}>
              <div style={{ width: 2, background: c, borderRadius: 2, flexShrink: 0, alignSelf: 'stretch', boxShadow: `0 0 4px ${c}` }} />
              <span style={{ fontSize: 13 }}>{e.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: c }}>{e.message}</span>
                {e.detail && <div style={{ fontSize: 9, color: '#253545', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detail}</div>}
              </div>
              <span style={{ fontSize: 9, color: '#1e2e3e', fontFamily: 'monospace', flexShrink: 0 }}>{ago(e.created_at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NichePanel({ niches, onActivate, onCreate }: {
  niches: Niche[]
  onActivate: (id: number) => void
  onCreate: (name: string, kws: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', keywords: '' })
  const active = niches.find(n => n.is_active)

  return (
    <div style={{ background: '#080d14', border: '1px solid #1a2235', borderRadius: 14,
      overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a2235',
        background: '#0a1020', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 10, letterSpacing: 2, color: '#4a5a6a' }}>⬡ GESTOR DE NICHOS</span>
        <button onClick={() => setAdding(a => !a)} style={{
          background: adding ? '#ff336622' : '#00ff8822', border: `1px solid ${adding ? '#ff3366' : '#00ff88'}44`,
          color: adding ? '#ff3366' : '#00ff88', borderRadius: 6, padding: '4px 10px',
          fontSize: 10, cursor: 'pointer', letterSpacing: 1,
        }}>{adding ? '✕ CANCELAR' : '+ NUEVO'}</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {/* Active niche highlight */}
        {active && (
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10,
            background: '#0a1a0a', border: '1px solid #00ff8833',
            boxShadow: '0 0 16px #00ff8811' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00ff88',
                boxShadow: '0 0 8px #00ff88', animation: 'blink 1.5s infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#00ff88' }}>{active.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: '#1a3a2a', background: '#00ff8811',
                border: '1px solid #00ff8822', borderRadius: 4, padding: '2px 6px' }}>ACTIVO</span>
            </div>
            <div style={{ fontSize: 10, color: '#1a4a2a', marginBottom: 6 }}>
              {active.keywords.slice(0, 6).join(' · ')}{active.keywords.length > 6 ? ` +${active.keywords.length - 6}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#2a4a3a' }}>
              <span>🎬 {active.clip_count} clips</span>
              <span>👁 ≥{(active.min_views / 1000).toFixed(0)}K views</span>
              <span>📡 ≥{(active.min_subscribers / 1000).toFixed(0)}K subs</span>
            </div>
          </div>
        )}

        {/* Add form */}
        {adding && (
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10,
            background: '#0a1420', border: '1px solid #00aaff33' }}>
            <input
              placeholder="Nombre del nicho (ej: FIFA 2025)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ width: '100%', background: '#060a12', border: '1px solid #1a2a3a',
                borderRadius: 6, padding: '7px 10px', color: '#c8d8ff', fontSize: 11,
                marginBottom: 8, outline: 'none', fontFamily: 'monospace' }}
            />
            <textarea
              placeholder="Keywords separadas por coma (ej: FIFA 2025, FIFA gameplay, EA Sports)"
              value={form.keywords}
              onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
              rows={3}
              style={{ width: '100%', background: '#060a12', border: '1px solid #1a2a3a',
                borderRadius: 6, padding: '7px 10px', color: '#c8d8ff', fontSize: 11,
                marginBottom: 8, outline: 'none', resize: 'none', fontFamily: 'monospace' }}
            />
            <button
              onClick={() => {
                if (form.name && form.keywords) {
                  onCreate(form.name, form.keywords)
                  setForm({ name: '', keywords: '' })
                  setAdding(false)
                }
              }}
              style={{ width: '100%', background: '#00aaff22', border: '1px solid #00aaff44',
                color: '#00aaff', borderRadius: 7, padding: '8px', fontSize: 11,
                cursor: 'pointer', letterSpacing: 1 }}>
              ✦ CREAR NICHO
            </button>
          </div>
        )}

        {/* All niches */}
        {niches.filter(n => !n.is_active).map(n => (
          <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 9, marginBottom: 8,
            background: '#0a1020', border: '1px solid #1a2235' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8a9aaa' }}>{n.name}</div>
              <div style={{ fontSize: 9, color: '#2a3a4a', marginTop: 2 }}>
                {n.clip_count} clips · {n.keywords.length} keywords
              </div>
            </div>
            <button
              onClick={() => onActivate(n.id)}
              style={{ marginLeft: 'auto', background: '#1a2a3a', border: '1px solid #2a3a4a',
                color: '#5a7a9a', borderRadius: 6, padding: '4px 10px',
                fontSize: 9, cursor: 'pointer', letterSpacing: 1, whiteSpace: 'nowrap' }}>
              ACTIVAR
            </button>
          </div>
        ))}

        {niches.length === 0 && !adding && (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: '#1a2a3a', fontSize: 11 }}>
            Crea tu primer nicho adicional
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function LiveDashboard({ initialStats }: { initialStats: Stats }) {
  const [stats,      setStats]      = useState(initialStats)
  const [logs,       setLogs]       = useState<LogEntry[]>([])
  const [botStatus,  setBotStatus]  = useState<BotStatus | null>(null)
  const [flash,      setFlash]      = useState<Record<string, boolean>>({})
  const [platformSt, setPlatformSt] = useState<Record<string, PlatformStat>>({})
  const [niches,     setNiches]     = useState<Niche[]>([])
  const [tick,       setTick]       = useState(0)
  const prevStats = useRef(initialStats)

  const vClips     = useCount(stats.clips)
  const vDone      = useCount(stats.done)
  const vQueue     = useCount(stats.queue)
  const vMonitored = useCount(stats.monitored)

  const poll = useCallback(async () => {
    const sb = createClient()
    const [
      vids, clips, queue, done, failed,
      logsRes, statusRes, quotaRes, monRes,
      uploadsRes, nichesRes,
    ] = await Promise.all([
      sb.from('videos').select('id', { count: 'exact', head: true }),
      sb.from('clips').select('id', { count: 'exact', head: true }),
      sb.from('clips').select('id', { count: 'exact', head: true }).in('status', ['ready','approved','queued']),
      sb.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'done'),
      sb.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      sb.from('bot_logs').select('id,icon,message,detail,level,created_at').order('id', { ascending: false }).limit(60),
      sb.from('bot_status').select('is_running,last_seen,current_task').eq('id', 1).single(),
      sb.from('daily_quota').select('count').eq('date', new Date().toISOString().slice(0,10)).single(),
      sb.from('streamers').select('id', { count: 'exact', head: true }).eq('is_monitored', true),
      sb.from('uploads').select('platform,status,uploaded_at').order('uploaded_at', { ascending: false }),
      sb.from('niches').select('*').order('created_at'),
    ])

    const next: Stats = {
      videos:    vids.count    ?? 0,
      clips:     clips.count   ?? 0,
      queue:     queue.count   ?? 0,
      done:      done.count    ?? 0,
      failed:    failed.count  ?? 0,
      today:     (quotaRes.data as any)?.count ?? 0,
      monitored: monRes.count  ?? 0,
    }

    const changed = (Object.keys(next) as (keyof Stats)[]).filter(k => next[k] !== prevStats.current[k])
    if (changed.length) {
      const f: Record<string, boolean> = {}
      changed.forEach(k => { f[k] = true })
      setFlash(f)
      setTimeout(() => setFlash({}), 1600)
    }
    prevStats.current = next
    setStats(next)

    if (logsRes.data)   setLogs(logsRes.data as LogEntry[])
    if (statusRes.data) setBotStatus(statusRes.data as BotStatus)
    if (nichesRes.data) setNiches(nichesRes.data as Niche[])

    // Build per-platform stats
    const pst: Record<string, PlatformStat> = {}
    for (const p of PLATFORMS_CFG) pst[p.key] = { total: 0, success: 0, failed: 0, last_upload: null }
    for (const u of (uploadsRes.data ?? []) as any[]) {
      const k = u.platform
      if (!pst[k]) continue
      pst[k].total++
      if (u.status === 'done')   { pst[k].success++; if (!pst[k].last_upload) pst[k].last_upload = u.uploaded_at }
      if (u.status === 'failed') pst[k].failed++
    }
    setPlatformSt(pst)
    setTick(t => t + 1)
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, REFRESH_MS)
    return () => clearInterval(id)
  }, [poll])

  const isActive = botStatus
    ? (Date.now() - new Date(botStatus.last_seen).getTime()) < 3 * 60 * 1000
    : false

  async function handleActivate(id: number) {
    const sb = createClient()
    await sb.from('niches').update({ is_active: false }).neq('id', 0)
    await sb.from('niches').update({ is_active: true }).eq('id', id)
    poll()
  }

  async function handleCreate(name: string, kws: string) {
    const sb = createClient()
    const keywords = kws.split(',').map(k => k.trim()).filter(Boolean)
    await sb.from('niches').insert({ name, keywords, is_active: false })
    poll()
  }

  const cycleCards = [
    { key: 'clips',     label: 'Clips Procesados',   value: vClips,     icon: '🎬', color: '#aa44ff', sub: 'este ciclo y total' },
    { key: 'today',     label: 'Publicados Hoy',      value: `${stats.today}/7`, icon: '📤', color: '#00ff88', sub: 'quota diaria' },
    { key: 'monitored', label: 'Lives Monitoreados',  value: vMonitored, icon: '👁️', color: '#00aaff', sub: 'en tiempo real' },
    { key: 'queue',     label: 'En Cola',             value: vQueue,     icon: '⏳', color: '#ffaa00', sub: 'próximo ciclo' },
  ]

  return (
    <>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gradShift { 0%{background-position:0%} 50%{background-position:100%} 100%{background-position:0%} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(0,255,136,0.4)} 50%{box-shadow:0 0 0 8px rgba(0,255,136,0)} }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-track{background:#060a12} ::-webkit-scrollbar-thumb{background:#1a2a3a;border-radius:2px}
        input::placeholder,textarea::placeholder{color:#2a3a4a}
        button:hover{opacity:0.85}
      `}</style>

      <div style={{ background: '#050810', minHeight: '100vh', color: '#c8d8ff', padding: '20px 24px' }}>
        {/* Fixed grid overlay */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'linear-gradient(#0a1428 1px,transparent 1px),linear-gradient(90deg,#0a1428 1px,transparent 1px)',
          backgroundSize: '48px 48px', opacity: 0.35 }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1440, margin: '0 auto' }}>

          {/* ══ HEADER ════════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #1a2235' }}>
            <div>
              <div style={{
                fontSize: 20, fontWeight: 900, letterSpacing: 3,
                background: 'linear-gradient(90deg,#00aaff,#aa44ff,#00ff88)',
                backgroundSize: '200%', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                animation: 'gradShift 5s ease infinite',
              }}>⚡ SOCIAL SHORTS — CONTENT FACTORY</div>
              <div style={{ fontSize: 10, color: '#2a3a4a', letterSpacing: 2, marginTop: 2 }}>
                {niches.find(n => n.is_active)?.name ?? 'GTA6'} · AUTO-PUBLISH PIPELINE · SYNC #{tick}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Bot pill */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                background: isActive ? '#00ff8811' : '#0a1020',
                border: `1px solid ${isActive ? '#00ff8855' : '#1a2235'}`,
                borderRadius: 999, transition: 'all 0.5s',
                boxShadow: isActive ? '0 0 16px #00ff8822' : 'none',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%',
                  background: isActive ? '#00ff88' : '#2a3a4a',
                  boxShadow: isActive ? '0 0 8px #00ff88' : 'none',
                  animation: isActive ? 'pulse 2s infinite' : 'none' }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2,
                  color: isActive ? '#00ff88' : '#3a4a5a' }}>
                  {isActive ? (botStatus?.current_task?.toUpperCase() ?? 'ACTIVO') : 'OFFLINE'}
                </span>
              </div>
              {/* Last seen */}
              {botStatus && (
                <div style={{ fontSize: 10, color: '#2a3a4a', fontFamily: 'monospace' }}>
                  SYNC {ago(botStatus.last_seen)}
                </div>
              )}
            </div>
          </div>

          {/* ══ SECTION 1: CYCLE STATS ════════════════════════════════════════ */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: '#2a3a4a', letterSpacing: 2, marginBottom: 10 }}>
              ● ESTADÍSTICAS DEL CICLO
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {cycleCards.map(c => (
                <CycleCard key={c.key} label={c.label} value={c.value}
                  sub={c.sub} icon={c.icon} color={c.color} flash={!!flash[c.key]} />
              ))}
            </div>
          </div>

          {/* ══ SECTION 2: PLATFORMS ══════════════════════════════════════════ */}
          <div style={{ marginBottom: 6, marginTop: 24 }}>
            <div style={{ fontSize: 10, color: '#2a3a4a', letterSpacing: 2, marginBottom: 10 }}>
              ● PLATAFORMAS
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {PLATFORMS_CFG.map(cfg => (
                <PlatformCard key={cfg.key} cfg={cfg}
                  stat={platformSt[cfg.key] ?? { total: 0, success: 0, failed: 0, last_upload: null }}
                  isActive={isActive} />
              ))}
            </div>
          </div>

          {/* ══ SECTION 3: LOG + NICHES ═══════════════════════════════════════ */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 14, alignItems: 'start' }}>

              {/* Activity log */}
              <div>
                <div style={{ fontSize: 10, color: '#2a3a4a', letterSpacing: 2, marginBottom: 10 }}>
                  ● ACTIVIDAD EN TIEMPO REAL
                </div>
                <LogFeed logs={logs} />
              </div>

              {/* Niches panel */}
              <div>
                <div style={{ fontSize: 10, color: '#2a3a4a', letterSpacing: 2, marginBottom: 10 }}>
                  ● NICHOS
                </div>
                <NichePanel niches={niches} onActivate={handleActivate} onCreate={handleCreate} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
