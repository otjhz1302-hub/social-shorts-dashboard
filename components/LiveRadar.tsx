'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SearchNowButton from '@/components/SearchNowButton'

type Spike = { at: string; secs: number; to: number; reason?: string; chat?: number }
type Point = [string, number, number?]   // [iso, viewers, chat msgs/min]
type Live = {
  video_id: string; title: string | null; channel: string | null; channel_id?: string | null; status: string
  viewers: number; peak: number; chat_rate?: number | null; series: Point[] | null; spikes: Spike[] | null
  started_at: string; updated_at: string
  viral_potential?: number | null; potential?: Potential | null
}
// core/radar.py, recomputed by the bot every minute per live
type Potential = {
  score: number; tier: string; reason: string; learned_from: number
  factors: Record<string, number>; weights: Record<string, number>
}
type LiveJob = { id: number; source_id: string; stage: string; message: string | null; hook: string | null; updated_at: string }

const FACTORS: [string, string][] = [
  ['chat', 'Chat'], ['momentum', 'Impulso'], ['streak', 'Racha'], ['reach', 'Alcance'], ['history', 'Historial'], ['fresh', 'Frescura'],
]
const MEDAL = ['🥇', '🥈', '🥉']
const tierColor = (s: number) => s >= 75 ? '#ff3366' : s >= 55 ? '#ffaa00' : s >= 35 ? '#00aaff' : '#5a7a9a'
const byPotential = (a: Live, b: Live) => (b.viral_potential ?? -1) - (a.viral_potential ?? -1)

const STATUS: Record<string, { label: string; color: string }> = {
  watching:  { label: '● EN VIVO',           color: '#ff3366' },
  ended:     { label: 'TERMINADO',           color: '#ffaa00' },
  harvested: { label: '✂ ENVIADO AL EDITOR', color: '#00ff88' },
}
const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
// Twitch lives are stored as video_id "twitch-<stream id>" with the channel login in channel_id
const isTwitch = (l: Live) => l.video_id.startsWith('twitch-')
const thumbOf = (l: Live) => isTwitch(l)
  ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_${l.channel_id}-640x360.jpg` : ytThumb(l.video_id)
const embedOf = (l: Live) => isTwitch(l)
  ? `https://player.twitch.tv/?channel=${l.channel_id}&parent=${window.location.hostname}&muted=true`
  : `https://www.youtube.com/embed/${l.video_id}?autoplay=1&mute=1`
const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n)
function ago(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 60) return `hace ${d}s`
  if (d < 3600) return `hace ${Math.floor(d / 60)}m`
  return `hace ${Math.floor(d / 3600)}h`
}

const CSS = `
@keyframes lr-sweep { from{transform:rotate(0)} to{transform:rotate(360deg)} }
@keyframes lr-ping { 0%{r:4;opacity:1} 100%{r:14;opacity:0} }
@keyframes lr-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
@keyframes lr-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
@keyframes lr-dots { 0%{content:''} 33%{content:'.'} 66%{content:'..'} 100%{content:'...'} }
.lr-card{background:#080d14;border:1px solid #1a2235;border-radius:16px;overflow:hidden}
.lr-label{font-size:10px;letter-spacing:2px;color:#3a4a5a;text-transform:uppercase}
`

function Radar({ size = 34, active = true }: { size?: number; active?: boolean }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', position: 'relative', border: '1px solid #00ff8855',
      background: 'radial-gradient(circle,#00ff8811 0 30%,transparent 31% 60%,#00ff8811 61%)', overflow: 'hidden', flexShrink: 0 }}>
      {active && <div style={{ position: 'absolute', inset: 0, background: 'conic-gradient(from 0deg,#00ff8888,transparent 25%)',
        animation: 'lr-sweep 2.4s linear infinite' }} />}
    </div>
  )
}

function ViewerChart({ series, spikes }: { series: Point[]; spikes: Spike[] }) {
  const W = 360, H = 80
  if (series.length < 2) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#2a4a3a',
        fontFamily: 'monospace', border: '1px dashed #14203a', borderRadius: 8 }}>
        recolectando audiencia y chat (1 punto por minuto)…
      </div>
    )
  }
  const vals = series.map(p => p[1])
  const max = Math.max(...vals, 1), min = Math.min(...vals)
  const x = (i: number) => (i / (series.length - 1)) * W
  const y = (v: number) => H - 8 - ((v - min) / Math.max(max - min, 1)) * (H - 18)
  const line = series.map((p, i) => `${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ')
  const chatMax = Math.max(...series.map(p => p[2] ?? 0), 1)
  const chat = series.map((p, i) => `${x(i).toFixed(1)},${(H - 4 - ((p[2] ?? 0) / chatMax) * (H - 14)).toFixed(1)}`).join(' ')
  const times = series.map(p => new Date(p[0]).getTime())
  const marks = spikes.map(s => {
    const t = new Date(s.at).getTime()
    let best = 0
    times.forEach((tt, i) => { if (Math.abs(tt - t) < Math.abs(times[best] - t)) best = i })
    return { i: best, s }
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lr-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#00ff88" stopOpacity=".35" />
          <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill="url(#lr-area)" />
      <polyline points={chat} fill="none" stroke="#ff44cc" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.8}
        vectorEffect="non-scaling-stroke" />
      <polyline points={line} fill="none" stroke="#00ff88" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {marks.map(({ i, s }, k) => (
        <g key={k}>
          <circle cx={x(i)} cy={y(series[i][1])} r={4} fill="#ff3366" />
          <circle cx={x(i)} cy={y(series[i][1])} r={4} fill="none" stroke="#ff3366" strokeWidth={2}
            style={{ animation: 'lr-ping 1.4s ease-out infinite' }}>
            <title>🔥 {fmt(s.to)} viewers @ min {Math.floor(s.secs / 60)}</title>
          </circle>
        </g>
      ))}
    </svg>
  )
}

// Hierarchy of what's on air: the lives most likely to give a viral moment first, and why
function TopRanking({ lives }: { lives: Live[] }) {
  if (!lives.length) return null
  const learned = lives.find(l => l.potential)?.potential?.learned_from ?? 0
  return (
    <div className="lr-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div className="lr-label" style={{ color: '#ffaa00' }}>🏆 Top potencial viral · en vivo ahora</div>
        <div style={{ fontSize: 10, color: '#3a4a5a' }}>
          {learned
            ? `pesos aprendidos de ${learned} minuto(s) previos a momentos virales · se re-entrena cada 6 h`
            : 'pesos iniciales · el radar aprende cada 6 h de los lives que vigila'}
        </div>
      </div>
      {lives.slice(0, 10).map((l, i) => {
        const p = l.potential, s = l.viral_potential ?? 0, c = tierColor(s)
        return (
          <div key={l.video_id} style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,1fr) auto', gap: 12, alignItems: 'center',
            padding: '10px 4px', borderTop: i ? '1px solid #0d1525' : 'none', animation: 'lr-fade .3s' }}>
            <div style={{ fontSize: i < 3 ? 22 : 13, textAlign: 'center', fontFamily: 'monospace', color: '#4a5a6a' }}>
              {MEDAL[i] ?? `#${i + 1}`}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e8f0ff' }}>
                  {isTwitch(l) && <span style={{ color: '#a970ff' }}>Twitch · </span>}{l.channel}
                </span>
                {p && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, padding: '2px 7px', borderRadius: 5,
                  background: c + '22', color: c }}>{p.tier}</span>}
                <span style={{ fontSize: 10, color: '#4a5a6a' }}>{fmt(l.viewers)} viendo · {(l.spikes ?? []).length} pico(s)</span>
              </div>
              <div style={{ fontSize: 11, color: c, marginTop: 2 }}>{p ? `▲ ${p.reason}` : 'calculando… (necesita unos minutos de datos)'}</div>
              {p && (
                <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                  {FACTORS.map(([k, label]) => (
                    <div key={k} title={`${label}: ${Math.round((p.factors[k] ?? 0) * 100)}/100 · peso ${Math.round((p.weights[k] ?? 0) * 100)}%`}
                      style={{ width: 62 }}>
                      <div style={{ fontSize: 8, color: '#4a5a6a', letterSpacing: .5 }}>{label}</div>
                      <div style={{ height: 3, background: '#0e1626', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${(p.factors[k] ?? 0) * 100}%`, background: c, borderRadius: 2,
                          opacity: .35 + (p.weights[k] ?? 0), transition: 'width 1s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'monospace', color: c, textShadow: `0 0 12px ${c}66` }}>
                {p ? Math.round(s) : '··'}
              </div>
              <div style={{ fontSize: 8, color: '#3a4a5a', letterSpacing: 1 }}>POTENCIAL</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LiveCard({ live, job, rank }: { live: Live; job?: LiveJob; rank?: number }) {
  const [playing, setPlaying] = useState(false)
  const st = STATUS[live.status] ?? STATUS.ended
  const spikes = live.spikes ?? []
  const pc = tierColor(live.viral_potential ?? 0)
  return (
    <div className="lr-card" style={{ animation: 'lr-fade .4s', borderColor: spikes.length ? '#ff336655' : '#1a2235' }}>
      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000' }}>
        {playing ? (
          <iframe src={embedOf(live)} title={live.title ?? ''}
            allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen
            style={{ width: '100%', height: '100%', border: 0 }} />
        ) : (
          <button onClick={() => setPlaying(true)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', height: '100%' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbOf(live)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#0006', fontSize: 13, letterSpacing: 2, color: '#fff' }}>▶ VER EN VIVO</span>
          </button>
        )}
        <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, fontWeight: 800, letterSpacing: 1, padding: '3px 8px',
          borderRadius: 5, background: st.color, color: '#050810', animation: live.status === 'watching' ? 'lr-blink 1.4s infinite' : 'none' }}>
          {st.label}
        </span>
        {rank && live.potential && (
          <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, fontWeight: 900, fontFamily: 'monospace',
            padding: '3px 8px', borderRadius: 6, background: '#050810dd', color: pc, border: `1px solid ${pc}` }}>
            #{rank} · {Math.round(live.viral_potential ?? 0)}
          </span>
        )}
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Radar active={live.status === 'watching'} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#c8d8ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {live.title}
            </div>
            <div style={{ fontSize: 10, color: '#4a5a6a' }}>
              {isTwitch(live) && <span style={{ color: '#a970ff' }}>Twitch · </span>}{live.channel} · actualizado {ago(live.updated_at)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: '#00ff88' }}>{fmt(live.viewers)}</div>
            <div style={{ fontSize: 9, color: '#3a4a5a' }}>pico {fmt(live.peak)}</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}><ViewerChart series={live.series ?? []} spikes={spikes} /></div>
        <div style={{ display: 'flex', gap: 12, fontSize: 9, color: '#4a5a6a', marginTop: 4 }}>
          <span><span style={{ color: '#00ff88' }}>━</span> audiencia</span>
          <span><span style={{ color: '#ff44cc' }}>┅</span> chat {live.chat_rate ?? 0} msg/min</span>
          <span><span style={{ color: '#ff3366' }}>●</span> momento viral</span>
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {spikes.length === 0 ? (
            <div style={{ fontSize: 10, color: '#2a3a4a' }}>
              Sin momentos aún — se dispara con una explosión del chat (×2.5 con reacciones) o +15% de audiencia.
            </div>
          ) : spikes.map((s, i) => (
            <div key={i} style={{ fontSize: 11, color: '#ff88aa', fontFamily: 'monospace', animation: 'lr-fade .3s' }}>
              🔥 min {Math.floor(s.secs / 60)} · {s.reason ?? `${fmt(s.to)} viewers`}
            </div>
          ))}
          {job && (
            <div style={{ fontSize: 11, color: '#00ff88', fontFamily: 'monospace' }}>
              ✂️ en el editor: {job.message ?? job.stage}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LiveRadar() {
  const [lives, setLives] = useState<Live[]>([])
  const [jobs, setJobs] = useState<LiveJob[]>([])
  const [error, setError] = useState<string | null>(null)

  const poll = useCallback(async () => {
    const sb = createClient()
    const onAir = (col: string) => sb.from('live_watches').select('*').eq('status', 'watching')
      .order(col, { ascending: false, nullsFirst: false }).limit(30)
    const [w, e, j] = await Promise.all([
      onAir('viral_potential').then(r => r.error ? onAir('updated_at') : r),   // before schema_radar.sql
      sb.from('live_watches').select('*').neq('status', 'watching').order('updated_at', { ascending: false }).limit(8),
      sb.from('pipeline_jobs').select('id,source_id,stage,message,hook,updated_at').eq('origin', 'live')
        .order('updated_at', { ascending: false }).limit(20),
    ])
    const err = w.error ?? e.error
    if (err) setError(err.message)
    else { setError(null); setLives([...(w.data as Live[]).sort(byPotential), ...(e.data as Live[])]) }
    if (j.data) setJobs(j.data as LiveJob[])
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [poll])

  const watching = lives.filter(l => l.status === 'watching')
  const totalSpikes = lives.reduce((n, l) => n + (l.spikes?.length ?? 0), 0)
  const jobFor = (id: string) => jobs.find(j => j.source_id === id)

  return (
    <div style={{ background: '#050810', minHeight: '100vh', color: '#c8d8ff', padding: '22px 24px' }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Radar size={44} active={watching.length > 0} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3, background: 'linear-gradient(90deg,#00ff88,#00aaff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>📡 LIVE RADAR</div>
            <div style={{ fontSize: 10, color: '#3a4a5a', letterSpacing: 2 }}>
              CHAT EN TIEMPO REAL + AUDIENCIA · MOMENTO VIRAL → SE CORTA EL ÚLTIMO MINUTO AL INSTANTE Y PASA AL EDITOR
            </div>
          </div>
          <SearchNowButton />
          {[
            { label: 'Vigilando', value: watching.length, color: '#ff3366' },
            { label: 'Picos detectados', value: totalSpikes, color: '#ffaa00' },
            { label: 'Enviados al editor', value: jobs.length, color: '#00ff88' },
          ].map(s => (
            <div key={s.label} className="lr-card" style={{ padding: '10px 16px', textAlign: 'center', minWidth: 120 }}>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'monospace', color: s.color }}>{s.value}</div>
              <div className="lr-label">{s.label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="lr-card" style={{ padding: 16, borderColor: '#ffaa0055', color: '#ffcc66', fontSize: 12 }}>
            ⚠️ No se pudo leer <code>live_watches</code> ({error}). Ejecuta <code>supabase/schema_studio.sql</code> y{' '}
            <code>supabase/schema_radar.sql</code> en Supabase.
          </div>
        )}

        <TopRanking lives={watching} />

        {lives.length === 0 ? (
          <div className="lr-card" style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Radar size={90} /></div>
            <div style={{ letterSpacing: 2, fontSize: 12, marginTop: 16, color: '#2a5a4a' }}>ESCANEANDO TRANSMISIONES EN VIVO</div>
            <div style={{ fontSize: 11, marginTop: 6, color: '#2a3a4a' }}>
              Cuando el descubrimiento encuentre lives del nicho (hasta 10 a la vez) aparecerán aquí con su audiencia en tiempo real.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {lives.map(l => <LiveCard key={l.video_id} live={l} job={jobFor(l.video_id)}
              rank={l.status === 'watching' ? watching.indexOf(l) + 1 : undefined} />)}
          </div>
        )}
      </div>
    </div>
  )
}
