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

const REFRESH_MS = 4000

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 5)  return 'AHORA'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
}

function useAnimatedNumber(target: number) {
  const [display, setDisplay] = useState(target)
  const prev = useRef(target)
  useEffect(() => {
    if (prev.current === target) return
    const start = prev.current
    const diff  = target - start
    const steps = 20
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplay(Math.round(start + diff * (i / steps)))
      if (i >= steps) { clearInterval(id); prev.current = target }
    }, 30)
    return () => clearInterval(id)
  }, [target])
  return display
}

function GlowRing({ active }: { active: boolean }) {
  return (
    <div className="relative w-32 h-32 mx-auto">
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: `2px solid ${active ? '#00ff88' : '#1e2a3a'}`,
        boxShadow: active ? '0 0 20px #00ff8866, 0 0 60px #00ff8822, inset 0 0 20px #00ff8811' : 'none',
        animation: active ? 'ringPulse 2s ease-in-out infinite' : 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 8, borderRadius: '50%',
        border: `1px solid ${active ? '#00ff8844' : '#1e2a3a33'}`,
        animation: active ? 'ringPulse 2s ease-in-out infinite 0.4s' : 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 16, borderRadius: '50%',
        background: active ? 'radial-gradient(circle, #00ff8822 0%, transparent 70%)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 2,
      }}>
        <div style={{
          fontSize: 28,
          filter: active ? 'drop-shadow(0 0 8px #00ff88)' : 'none',
        }}>🤖</div>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 2,
          color: active ? '#00ff88' : '#3a4a5a',
          textShadow: active ? '0 0 8px #00ff88' : 'none',
        }}>{active ? 'ACTIVO' : 'OFFLINE'}</div>
      </div>
    </div>
  )
}

function StatHex({ value, label, color, icon, anim }: {
  value: number | string; label: string; color: string; icon: string; anim: boolean
}) {
  return (
    <div style={{
      background: '#080d14',
      border: `1px solid ${anim ? color : '#1a2235'}`,
      borderRadius: 12,
      padding: '14px 16px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.3s, box-shadow 0.3s',
      boxShadow: anim ? `0 0 20px ${color}44, inset 0 0 20px ${color}11` : 'none',
    }}>
      {anim && (
        <div style={{
          position: 'absolute', top: 0, left: '-100%', right: 0, height: '100%',
          background: `linear-gradient(90deg, transparent, ${color}22, transparent)`,
          animation: 'scanH 0.8s ease-out',
        }} />
      )}
      <div style={{ color, fontSize: 22, marginBottom: 4,
        textShadow: `0 0 12px ${color}`,
        filter: `drop-shadow(0 0 6px ${color})`,
      }}>{icon}</div>
      <div style={{
        fontSize: 28, fontWeight: 800, fontFamily: 'monospace',
        color, textShadow: `0 0 15px ${color}99`,
        lineHeight: 1,
      }}>{value}</div>
      <div style={{ fontSize: 10, color: '#4a5a6a', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}

function QuotaBar({ today, max = 7 }: { today: number; max?: number }) {
  const pct = Math.min(100, (today / max) * 100)
  const color = pct > 85 ? '#ff3366' : pct > 60 ? '#ffaa00' : '#00ff88'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: '#5a6a7a', letterSpacing: 1 }}>
        <span>QUOTA DIARIA</span>
        <span style={{ color, fontWeight: 700 }}>{today}/{max}</span>
      </div>
      <div style={{ background: '#0a1020', borderRadius: 4, height: 6, overflow: 'hidden', border: '1px solid #1a2235' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          boxShadow: `0 0 10px ${color}`,
          borderRadius: 4,
          transition: 'width 0.8s ease',
          animation: 'quotaGlow 2s ease-in-out infinite',
        }} />
      </div>
    </div>
  )
}

function LogLine({ entry, idx }: { entry: LogEntry; idx: number }) {
  const colors: Record<string, string> = {
    success: '#00ff88', error: '#ff3366', warning: '#ffaa00', info: '#00aaff',
  }
  const c = colors[entry.level] ?? '#5a7a9a'
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 14px',
      borderBottom: '1px solid #0d1525',
      animation: `fadeIn 0.3s ease-out ${idx === 0 ? '0s' : ''}`,
      background: idx === 0 ? '#0a1525' : 'transparent',
      transition: 'background 0.3s',
    }}>
      <div style={{ width: 2, alignSelf: 'stretch', background: c, borderRadius: 2, flexShrink: 0,
        boxShadow: `0 0 6px ${c}`,
      }} />
      <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{entry.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: c, fontSize: 12, fontFamily: 'monospace' }}>{entry.message}</span>
        {entry.detail && (
          <div style={{ color: '#354555', fontSize: 10, marginTop: 2, fontFamily: 'monospace',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{entry.detail}</div>
        )}
      </div>
      <span style={{ color: '#253545', fontSize: 10, fontFamily: 'monospace', flexShrink: 0 }}>
        {timeAgo(entry.created_at)}
      </span>
    </div>
  )
}

function MatrixRain() {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', opacity: 0.04,
    }}>
      {[...Array(12)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute', top: 0, left: `${i * 8.5}%`,
          fontFamily: 'monospace', fontSize: 11, color: '#00ff88',
          animation: `matrixFall ${3 + (i % 4)}s linear infinite`,
          animationDelay: `${i * 0.4}s`,
          whiteSpace: 'pre',
          lineHeight: 1.4,
        }}>
          {'01\n10\n01\n11\n00\n10\n01\n10\n11\n01\n00\n10\n01\n11\n00'.split('\n').map((v, j) => (
            <div key={j}>{v}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function LiveDashboard({ initialStats }: { initialStats: Stats }) {
  const [stats,     setStats]     = useState(initialStats)
  const [logs,      setLogs]      = useState<LogEntry[]>([])
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const [flash,     setFlash]     = useState<Record<string, boolean>>({})
  const [tick,      setTick]      = useState(0)
  const prevStats = useRef(initialStats)

  const vVideos    = useAnimatedNumber(stats.videos)
  const vClips     = useAnimatedNumber(stats.clips)
  const vDone      = useAnimatedNumber(stats.done)
  const vFailed    = useAnimatedNumber(stats.failed)
  const vQueue     = useAnimatedNumber(stats.queue)
  const vMonitored = useAnimatedNumber(stats.monitored)

  const poll = useCallback(async () => {
    const sb = createClient()
    const [
      vids, clips, queue, done, failed,
      logsRes, statusRes, quotaRes, monRes,
    ] = await Promise.all([
      sb.from('videos').select('id', { count: 'exact', head: true }),
      sb.from('clips').select('id', { count: 'exact', head: true }),
      sb.from('clips').select('id', { count: 'exact', head: true }).in('status', ['ready','approved','queued']),
      sb.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'done'),
      sb.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      sb.from('bot_logs').select('id,icon,message,detail,level,created_at').order('id', { ascending: false }).limit(50),
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
      monitored: monRes.count  ?? 0,
    }

    const changed = (Object.keys(next) as (keyof Stats)[]).filter(k => next[k] !== prevStats.current[k])
    if (changed.length) {
      const f: Record<string, boolean> = {}
      changed.forEach(k => { f[k] = true })
      setFlash(f)
      setTimeout(() => setFlash({}), 1500)
    }
    prevStats.current = next
    setStats(next)
    if (logsRes.data) setLogs(logsRes.data as LogEntry[])
    if (statusRes.data) setBotStatus(statusRes.data as BotStatus)
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

  const statCards = [
    { key: 'videos',    label: 'Detectados',  value: vVideos,    icon: '📡', color: '#00aaff' },
    { key: 'clips',     label: 'Clips',        value: vClips,     icon: '🎬', color: '#aa44ff' },
    { key: 'done',      label: 'Publicados',   value: vDone,      icon: '✅', color: '#00ff88' },
    { key: 'queue',     label: 'En Cola',      value: vQueue,     icon: '⏳', color: '#ffaa00' },
    { key: 'monitored', label: 'Streamers',    value: vMonitored, icon: '👁️', color: '#ff44aa' },
    { key: 'failed',    label: 'Errores',      value: vFailed,    icon: '⚠️', color: '#ff3366' },
  ]

  return (
    <>
      <style>{`
        @keyframes ringPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.04); }
        }
        @keyframes scanH {
          from { left: -100%; }
          to   { left: 100%; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes matrixFall {
          from { transform: translateY(-100%); }
          to   { transform: translateY(100vh); }
        }
        @keyframes quotaGlow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.3); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes scan {
          0% { top: -4px; }
          100% { top: 100%; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #060a12; }
        ::-webkit-scrollbar-thumb { background: #1a2a3a; border-radius: 2px; }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: '#050810',
        color: '#c8d8ff',
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background grid */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(#0a1428 1px, transparent 1px), linear-gradient(90deg, #0a1428 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          opacity: 0.4,
        }} />

        {/* Top glow */}
        <div style={{
          position: 'fixed', top: -80, left: '30%', right: '30%', height: 160,
          background: 'radial-gradient(ellipse, #00aaff22 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>

          {/* ── HEADER ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{
                fontSize: 22, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase',
                background: 'linear-gradient(90deg, #00aaff, #aa44ff, #00ff88)',
                backgroundSize: '200% 200%',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                animation: 'gradientShift 4s ease infinite',
              }}>
                ⚡ Social Shorts — Command Center
              </div>
              <div style={{ fontSize: 11, color: '#2a3a4a', letterSpacing: 2, marginTop: 2 }}>
                GTA6 CONTENT FACTORY · AUTO-PUBLISH PIPELINE · v2.0
              </div>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 18px',
              background: isActive ? '#00ff8811' : '#0a1020',
              border: `1px solid ${isActive ? '#00ff8866' : '#1a2235'}`,
              borderRadius: 999,
              boxShadow: isActive ? '0 0 20px #00ff8833' : 'none',
              transition: 'all 0.5s',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isActive ? '#00ff88' : '#2a3a4a',
                boxShadow: isActive ? '0 0 10px #00ff88' : 'none',
                animation: isActive ? 'blink 1.5s ease-in-out infinite' : 'none',
              }} />
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 2,
                color: isActive ? '#00ff88' : '#3a4a5a',
                textShadow: isActive ? '0 0 8px #00ff88' : 'none',
              }}>
                {isActive
                  ? (botStatus?.current_task?.toUpperCase() ?? 'PROCESANDO')
                  : 'SISTEMA OFFLINE'}
              </span>
            </div>
          </div>

          {/* ── MAIN GRID ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: 20, alignItems: 'start' }}>

            {/* ── LEFT: Bot status + stats ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Bot orb */}
              <div style={{
                background: '#080d14',
                border: `1px solid ${isActive ? '#00ff8833' : '#1a2235'}`,
                borderRadius: 16,
                padding: '24px 16px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                  background: isActive ? 'linear-gradient(90deg, transparent, #00ff88, transparent)' : 'transparent',
                  animation: isActive ? 'scan 2s ease-in-out infinite' : 'none',
                }} />
                <GlowRing active={isActive} />
                <div style={{ marginTop: 14 }}>
                  {isActive ? (
                    <>
                      <div style={{ fontSize: 12, color: '#00ff88', fontWeight: 600, letterSpacing: 1 }}>
                        BOT EN LÍNEA
                      </div>
                      <div style={{ fontSize: 10, color: '#3a5a4a', marginTop: 4, fontFamily: 'monospace' }}>
                        {botStatus?.current_task}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: '#3a4a5a', letterSpacing: 1 }}>BOT OFFLINE</div>
                      <div style={{ fontSize: 10, color: '#2a3a4a', marginTop: 4, fontFamily: 'monospace' }}>
                        {botStatus?.last_seen ? `último: ${timeAgo(botStatus.last_seen)}` : 'ejecuta scheduler.py'}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Quota bar */}
              <div style={{
                background: '#080d14', border: '1px solid #1a2235',
                borderRadius: 12, padding: '14px 16px',
              }}>
                <QuotaBar today={stats.today} />
                <div style={{ marginTop: 10, fontSize: 10, color: '#2a3a4a', letterSpacing: 1, textAlign: 'center' }}>
                  PRÓXIMO RESET · MEDIANOCHE UTC
                </div>
              </div>

              {/* Platforms */}
              <div style={{
                background: '#080d14', border: '1px solid #1a2235',
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 10, color: '#3a4a5a', letterSpacing: 2, marginBottom: 10 }}>PLATAFORMAS</div>
                {[
                  { name: 'YouTube', icon: '▶️', color: '#ff4444' },
                  { name: 'Instagram', icon: '📷', color: '#ff44aa' },
                  { name: 'Facebook', icon: '📘', color: '#4488ff' },
                ].map(p => (
                  <div key={p.name} style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7,
                  }}>
                    <span style={{ fontSize: 14 }}>{p.icon}</span>
                    <span style={{ flex: 1, fontSize: 11, color: '#8a9aaa' }}>{p.name}</span>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: isActive ? p.color : '#1a2235',
                      boxShadow: isActive ? `0 0 8px ${p.color}` : 'none',
                      animation: isActive ? 'blink 2s ease-in-out infinite' : 'none',
                    }} />
                  </div>
                ))}
              </div>
            </div>

            {/* ── CENTER: Live log ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Log terminal */}
              <div style={{
                background: '#060b14',
                border: '1px solid #1a2235',
                borderRadius: 16,
                overflow: 'hidden',
                position: 'relative',
              }}>
                {/* Terminal header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px',
                  background: '#080f1c',
                  borderBottom: '1px solid #1a2235',
                }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['#ff3366', '#ffaa00', '#00ff88'].map((c, i) => (
                      <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.8 }} />
                    ))}
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#3a4a5a', letterSpacing: 2, fontFamily: 'monospace' }}>
                    LIVE ACTIVITY FEED
                  </div>
                  <div style={{
                    fontSize: 10, color: isActive ? '#00ff88' : '#2a3a4a',
                    fontFamily: 'monospace', letterSpacing: 1,
                    animation: isActive ? 'blink 1s linear infinite' : 'none',
                  }}>
                    {isActive ? '● REC' : '○ IDLE'}
                  </div>
                </div>

                {/* Scanline overlay */}
                <div style={{ position: 'relative' }}>
                  <MatrixRain />
                  <div style={{ maxHeight: 480, overflowY: 'auto', position: 'relative' }}>
                    {logs.length === 0 ? (
                      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 36, marginBottom: 12, animation: 'float 3s ease-in-out infinite' }}>⚡</div>
                        <div style={{ color: '#2a3a4a', fontSize: 13, letterSpacing: 2 }}>ESPERANDO SEÑAL DEL BOT...</div>
                        <div style={{ color: '#1a2a3a', fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>
                          $ python scheduler.py
                        </div>
                      </div>
                    ) : (
                      logs.map((entry, i) => <LogLine key={entry.id} entry={entry} idx={i} />)
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT: Stat cards ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              <div style={{ fontSize: 10, color: '#2a3a4a', letterSpacing: 2, paddingLeft: 2 }}>MÉTRICAS EN TIEMPO REAL</div>

              {statCards.map(c => (
                <StatHex key={c.key} value={c.value} label={c.label}
                         color={c.color} icon={c.icon} anim={!!flash[c.key]} />
              ))}

              {/* Refresh indicator */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                background: '#080d14', border: '1px solid #1a2235', borderRadius: 10,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: `hsl(${(tick * 30) % 360}, 80%, 60%)`,
                  transition: 'background 0.3s',
                  boxShadow: `0 0 6px hsl(${(tick * 30) % 360}, 80%, 60%)`,
                }} />
                <span style={{ fontSize: 10, color: '#2a3a4a', letterSpacing: 1 }}>
                  SYNC #{tick} · {REFRESH_MS / 1000}s
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
