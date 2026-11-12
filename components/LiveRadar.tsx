'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Spike = { at: string; secs: number; to: number }
type Live = {
  video_id: string; title: string | null; channel: string | null; status: string
  viewers: number; peak: number; series: [string, number][] | null; spikes: Spike[] | null
  started_at: string; updated_at: string
}
type LiveJob = { id: number; source_id: string; stage: string; message: string | null; hook: string | null; updated_at: string }

const STATUS: Record<string, { label: string; color: string }> = {
  watching:  { label: '● EN VIVO',           color: '#ff3366' },
  ended:     { label: 'TERMINADO',           color: '#ffaa00' },
  harvested: { label: '✂ ENVIADO AL EDITOR', color: '#00ff88' },
}
const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
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

function ViewerChart({ series, spikes }: { series: [string, number][]; spikes: Spike[] }) {
  const W = 360, H = 80
  if (series.length < 2) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#2a4a3a',
        fontFamily: 'monospace', border: '1px dashed #14203a', borderRadius: 8 }}>
        recolectando audiencia (1 lectura cada 2 min)…
      </div>
    )
  }
  const vals = series.map(p => p[1])
  const max = Math.max(...vals, 1), min = Math.min(...vals)
  const x = (i: number) => (i / (series.length - 1)) * W
  const y = (v: number) => H - 8 - ((v - min) / Math.max(max - min, 1)) * (H - 18)
  const line = series.map((p, i) => `${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ')
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

function LiveCard({ live, job }: { live: Live; job?: LiveJob }) {
  const [playing, setPlaying] = useState(false)
  const st = STATUS[live.status] ?? STATUS.ended
  const spikes = live.spikes ?? []
  return (
    <div className="lr-card" style={{ animation: 'lr-fade .4s', borderColor: spikes.length ? '#ff336655' : '#1a2235' }}>
      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000' }}>
        {playing ? (
          <iframe src={`https://www.youtube.com/embed/${live.video_id}?autoplay=1&mute=1`} title={live.title ?? ''}
            allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen
            style={{ width: '100%', height: '100%', border: 0 }} />
        ) : (
          <button onClick={() => setPlaying(true)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', height: '100%' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ytThumb(live.video_id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#0006', fontSize: 13, letterSpacing: 2, color: '#fff' }}>▶ VER EN VIVO</span>
          </button>
        )}
        <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, fontWeight: 800, letterSpacing: 1, padding: '3px 8px',
          borderRadius: 5, background: st.color, color: '#050810', animation: live.status === 'watching' ? 'lr-blink 1.4s infinite' : 'none' }}>
          {st.label}
        </span>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Radar active={live.status === 'watching'} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#c8d8ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {live.title}
            </div>
            <div style={{ fontSize: 10, color: '#4a5a6a' }}>{live.channel} · actualizado {ago(live.updated_at)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: '#00ff88' }}>{fmt(live.viewers)}</div>
            <div style={{ fontSize: 9, color: '#3a4a5a' }}>pico {fmt(live.peak)}</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}><ViewerChart series={live.series ?? []} spikes={spikes} /></div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {spikes.length === 0 ? (
            <div style={{ fontSize: 10, color: '#2a3a4a' }}>Sin picos aún — se marca un pico con +15% de audiencia entre lecturas.</div>
          ) : spikes.map((s, i) => (
            <div key={i} style={{ fontSize: 11, color: '#ff88aa', fontFamily: 'monospace', animation: 'lr-fade .3s' }}>
              🔥 minuto {Math.floor(s.secs / 60)} → {fmt(s.to)} viewers
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
    const [l, j] = await Promise.all([
      sb.from('live_watches').select('*').order('updated_at', { ascending: false }).limit(20),
      sb.from('pipeline_jobs').select('id,source_id,stage,message,hook,updated_at').eq('origin', 'live')
        .order('updated_at', { ascending: false }).limit(20),
    ])
    if (l.error) setError(l.error.message)
    else { setError(null); setLives(l.data as Live[]) }
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
              AUDIENCIA CADA 2 MIN · +15% = MOMENTO VIRAL · AL TERMINAR EL LIVE EL PICO PASA AL EDITOR
            </div>
          </div>
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
            ⚠️ No se pudo leer <code>live_watches</code> ({error}). Ejecuta <code>supabase/schema_studio.sql</code> en Supabase.
          </div>
        )}

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
            {lives.map(l => <LiveCard key={l.video_id} live={l} job={jobFor(l.video_id)} />)}
          </div>
        )}
      </div>
    </div>
  )
}
