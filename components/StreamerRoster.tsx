'use client'
import { useCallback, useEffect, useState } from 'react'
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { createClient } from '@/lib/supabase/client'

type Streamer = {
  id: number; platform: string | null; channel_id: string; channel_name: string; avatar_url: string | null; subscribers: number | null
  score: number | null; tier: string | null; reach: number | null; consistency: number | null
  virality: number | null; effectiveness: number | null; live_days_14: number | null; live_days: string[] | null
  hours_watched: number | null; avg_viewers: number | null; peak_viewers: number | null; spikes_30: number | null
  clips_30: number | null; published_30: number | null; avg_clip_views: number | null
  is_live_now: boolean | null; live_video_id: string | null; last_live_at: string | null; blocked: boolean | null
}

// Live Radar's ranking of the live (core/radar.py), joined by the live's video id
type Pot = { viral_potential: number | null; potential: { tier: string; reason: string } | null }

const TIERS = [
  { key: 'elite',       label: 'Élite',          icon: '👑', color: '#ffd400', desc: 'Alto score y constantes: prioridad máxima' },
  { key: 'constante',   label: 'Constantes',     icon: '📅', color: '#00ff88', desc: 'En vivo casi todos los días' },
  { key: 'prometedor',  label: 'Prometedores',   icon: '🚀', color: '#00aaff', desc: 'Buen alcance o viralidad, poca historia aún' },
  { key: 'observacion', label: 'En observación', icon: '👁️', color: '#8a9aaa', desc: 'Recién descubiertos: el bot está midiendo' },
  { key: 'descartado',  label: 'Descartados',    icon: '⛔', color: '#ff3366', desc: 'Bloqueados o sin lives en 21 días' },
]
const METRICS = [
  { key: 'reach',         label: 'Alcance',     color: '#00aaff' },
  { key: 'consistency',   label: 'Constancia',  color: '#00ff88' },
  { key: 'virality',      label: 'Viralidad',   color: '#ff44cc' },
  { key: 'effectiveness', label: 'Efectividad', color: '#ffaa00' },
] as const
const tierOf = (k: string | null) => TIERS.find(t => t.key === (k ?? 'observacion')) ?? TIERS[3]
const fmt = (n: number | null | undefined) => {
  const v = n ?? 0
  return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(v >= 1e4 ? 0 : 1)}K` : String(v)
}
const last14 = () => Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.now() - (13 - i) * 86_400_000)
  return d.toISOString().slice(0, 10)
})

const CSS = `
@keyframes sr-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
@keyframes sr-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
@keyframes sr-ring { 0%{box-shadow:0 0 0 0 #ff336688} 100%{box-shadow:0 0 0 10px transparent} }
.sr-card{background:#080d14;border:1px solid #1a2235;border-radius:16px}
.sr-label{font-size:10px;letter-spacing:2px;color:#3a4a5a;text-transform:uppercase}
`

function Avatar({ s, size = 44 }: { s: Streamer; size?: number }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {s.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.avatar_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover',
          border: `2px solid ${s.is_live_now ? '#ff3366' : '#1e2a40'}`, animation: s.is_live_now ? 'sr-ring 1.4s infinite' : 'none' }} />
      ) : (
        <div style={{ width: size, height: size, borderRadius: '50%', background: '#14203a', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontWeight: 800, color: '#5a7a9a' }}>{s.channel_name.slice(0, 1)}</div>
      )}
      {s.is_live_now && (
        <span style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', fontSize: 8, fontWeight: 800,
          background: '#ff3366', color: '#fff', padding: '1px 5px', borderRadius: 4, letterSpacing: 1 }}>LIVE</span>
      )}
    </div>
  )
}

function StreamerCard({ s, i, pot, rank }: { s: Streamer; i: number; pot?: Pot; rank?: number }) {
  const t = tierOf(s.tier)
  const days = new Set(s.live_days ?? [])
  return (
    <div className="sr-card" style={{ padding: 14, borderColor: s.is_live_now ? '#ff336655' : '#1a2235', animation: `sr-fade .35s ${i * 0.03}s both` }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Avatar s={s} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e8f0ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {s.channel_name}
          </div>
          <div style={{ fontSize: 10, color: '#4a5a6a' }}>
            {s.platform === 'twitch' ? <span style={{ color: '#a970ff' }}>Twitch</span> : `${fmt(s.subscribers)} subs`} · {fmt(s.avg_viewers)} viewers prom.
            {' · '}<span style={{ color: t.color }}>{t.icon} {t.label}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: t.color, lineHeight: 1 }}>{Math.round(s.score ?? 0)}</div>
          <div style={{ fontSize: 8, color: '#3a4a5a', letterSpacing: 1 }}>SCORE</div>
        </div>
      </div>

      {rank && (
        <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 8, background: '#ff336611', border: '1px solid #ff336633',
          fontSize: 11, display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 900, color: '#ff3366' }}>#{rank}</span>
          {pot?.potential ? (
            <>
              <span style={{ fontWeight: 800, color: '#ffaa00', whiteSpace: 'nowrap' }}>
                {pot.potential.tier} {Math.round(pot.viral_potential ?? 0)}
              </span>
              <span style={{ color: '#8fb0d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>▲ {pot.potential.reason}</span>
            </>
          ) : <span style={{ color: '#5a7a8a' }}>potencial viral: calculando (Live Radar)…</span>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: 12 }}>
        {METRICS.map(m => {
          const v = (s[m.key] ?? 0) as number
          return (
            <div key={m.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#4a5a6a' }}>
                <span>{m.label}</span><span style={{ color: m.color }}>{Math.round(v * 100)}</span>
              </div>
              <div style={{ height: 4, background: '#0e1626', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${v * 100}%`, background: m.color, borderRadius: 2,
                  boxShadow: `0 0 6px ${m.color}88`, transition: 'width 1s' }} />
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#3a4a5a', marginBottom: 4 }}>
          <span>Constancia · últimos 14 días</span><span style={{ color: '#00ff88' }}>{s.live_days_14 ?? 0}/14</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 3 }}>
          {last14().map(d => (
            <div key={d} title={d} style={{ height: 10, borderRadius: 2, background: days.has(d) ? '#00ff88' : '#0e1626',
              boxShadow: days.has(d) ? '0 0 6px #00ff8866' : 'none' }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: 10, color: '#5a7a8a', flexWrap: 'wrap' }}>
        <span title="Momentos virales detectados (30 días)">🔥 {s.spikes_30 ?? 0}</span>
        <span title="Clips editados (30 días)">✂️ {s.clips_30 ?? 0}</span>
        <span title="Clips publicados (30 días)">🚀 {s.published_30 ?? 0}</span>
        <span title="Vistas promedio de nuestros clips">👁 {fmt(s.avg_clip_views)}</span>
        <span title="Horas vigiladas">⏱ {(s.hours_watched ?? 0).toFixed(1)} h</span>
        {s.is_live_now && s.live_video_id && (
          <a href={s.platform === 'twitch' ? `https://www.twitch.tv/${s.channel_id}` : `https://www.youtube.com/watch?v=${s.live_video_id}`}
            target="_blank" rel="noreferrer"
            style={{ color: '#ff3366', marginLeft: 'auto', animation: 'sr-blink 1.4s infinite' }}>● ver live</a>
        )}
      </div>
    </div>
  )
}

export default function StreamerRoster() {
  const [list, setList] = useState<Streamer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showDropped, setShowDropped] = useState(false)
  const [pots, setPots] = useState<Record<string, Pot>>({})

  const poll = useCallback(async () => {
    const sb = createClient()
    const { data, error } = await sb.from('streamers').select('*')
      .order('score', { ascending: false, nullsFirst: false }).limit(300)
    if (error) return setError(error.message)
    setError(null)
    setList(data as Streamer[])
    const ids = (data as Streamer[]).filter(s => s.is_live_now && s.live_video_id).map(s => s.live_video_id!)
    if (!ids.length) return setPots({})
    const { data: w } = await sb.from('live_watches').select('video_id,viral_potential,potential').in('video_id', ids)
    setPots(Object.fromEntries(((w ?? []) as (Pot & { video_id: string })[]).map(r => [r.video_id, r])))
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 15_000)
    return () => clearInterval(id)
  }, [poll])

  const potOf = (s: Streamer) => (s.live_video_id ? pots[s.live_video_id] : undefined)
  // on air, most likely to go viral first (Live Radar), then by roster score
  const live = list.filter(s => s.is_live_now).sort((a, b) =>
    ((potOf(b)?.viral_potential ?? -1) - (potOf(a)?.viral_potential ?? -1)) || ((b.score ?? 0) - (a.score ?? 0)))
  // the roster the bot checks every 10 min for a live (everyone not discarded or blocked)
  const watched = list.filter(s => !s.is_live_now && !s.blocked && s.tier !== 'descartado')
  const dropped = list.filter(s => !s.is_live_now && (s.blocked || s.tier === 'descartado'))
  const byTier = (k: string) => list.filter(s => (s.tier ?? 'observacion') === k)
  const points = list.filter(s => s.tier !== 'descartado').map(s => ({
    x: Math.round((s.consistency ?? 0) * 100), y: Math.round((s.reach ?? 0) * 100),
    z: 40 + (s.virality ?? 0) * 400, name: s.channel_name, score: Math.round(s.score ?? 0), tier: s.tier ?? 'observacion',
  }))

  return (
    <div style={{ background: '#050810', minHeight: '100vh', color: '#c8d8ff', padding: '22px 24px' }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3, background: 'linear-gradient(90deg,#ffd400,#ff44cc,#00aaff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>🏆 STREAMER ROSTER</div>
            <div style={{ fontSize: 10, color: '#3a4a5a', letterSpacing: 2 }}>
              ALCANCE 30% · CONSTANCIA 25% · VIRALIDAD 25% · EFECTIVIDAD 20% · SE RECALCULA CADA 6 H CON NUESTROS DATOS
            </div>
          </div>
          {[{ label: 'En vivo ahora', value: live.length, color: '#ff3366' },
            { label: 'Seleccionados', value: watched.length, color: '#00aaff' },
            ...TIERS.slice(0, 2).map(t => ({ label: t.label, value: byTier(t.key).length, color: t.color }))].map(c => (
            <div key={c.label} className="sr-card" style={{ padding: '10px 16px', textAlign: 'center', minWidth: 110 }}>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'monospace', color: c.color }}>{c.value}</div>
              <div className="sr-label">{c.label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="sr-card" style={{ padding: 16, borderColor: '#ffaa0055', color: '#ffcc66', fontSize: 12 }}>
            ⚠️ No se pudo leer el roster ({error}). Ejecuta <code>supabase/schema_studio.sql</code> en Supabase.
          </div>
        )}

        <Section icon="🔴" title="En vivo ahora" color="#ff3366" count={live.length}
          desc="Ordenados por potencial viral del Live Radar: arriba los que más probabilidad tienen de dar un momento viral">
          {live.length === 0 ? (
            <div className="sr-card" style={{ padding: 30, fontSize: 11, color: '#2a3a4a', textAlign: 'center' }}>
              Nadie del roster está en vivo ahora. El bot revisa cada 10 minutos.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {live.map((s, i) => <StreamerCard key={s.channel_id} s={s} i={i} pot={potOf(s)} rank={i + 1} />)}
            </div>
          )}
        </Section>

        <Section icon="👁" title="Seleccionados para vigilar" color="#00aaff" count={watched.length}
          desc="El bot revisa cada 10 minutos si salen en vivo, los mejores primero; en cuanto uno transmite pasa arriba">
          {watched.length === 0 ? (
            <div className="sr-card" style={{ padding: 30, fontSize: 11, color: '#2a3a4a', textAlign: 'center' }}>
              El roster está vacío: el descubrimiento agrega canales cuando encuentra lives del nicho.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {watched.map((s, i) => <StreamerCard key={s.channel_id} s={s} i={i} />)}
            </div>
          )}
        </Section>

        {dropped.length > 0 && (
          <button onClick={() => setShowDropped(v => !v)} style={{ alignSelf: 'flex-start', fontSize: 11, color: '#ff6688',
            background: 'none', border: '1px solid #ff336633', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            {showDropped ? 'Ocultar descartados' : `Ver descartados (${dropped.length})`}
          </button>
        )}
        {showDropped && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {dropped.map((s, i) => <StreamerCard key={s.channel_id} s={s} i={i} />)}
          </div>
        )}

        <div className="sr-card" style={{ padding: 16 }}>
          <div className="sr-label" style={{ marginBottom: 8 }}>Mapa de efectividad · constancia vs alcance · tamaño = viralidad</div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid stroke="#14203a" />
                <XAxis type="number" dataKey="x" name="Constancia" domain={[0, 100]} stroke="#3a4a5a" fontSize={10}
                  label={{ value: 'Constancia →', position: 'insideBottom', offset: -10, fill: '#3a4a5a', fontSize: 10 }} />
                <YAxis type="number" dataKey="y" name="Alcance" domain={[0, 100]} stroke="#3a4a5a" fontSize={10} />
                <ZAxis type="number" dataKey="z" range={[40, 440]} />
                <Tooltip cursor={{ stroke: '#1e2a40' }} contentStyle={{ background: '#0a1020', border: '1px solid #1a2235', fontSize: 11 }}
                  formatter={(v, n) => [v as number, n as string]}
                  labelFormatter={() => ''} />
                {TIERS.slice(0, 4).map(t => (
                  <Scatter key={t.key} name={t.label} data={points.filter(p => p.tier === t.key)} fill={t.color} fillOpacity={0.75} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', fontSize: 10, color: '#5a7a8a' }}>
            {TIERS.slice(0, 4).map(t => <span key={t.key}><span style={{ color: t.color }}>●</span> {t.label}</span>)}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ icon, title, color, count, desc, children }: {
  icon: string; title: string; color: string; count: number; desc: string; children: React.ReactNode
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color }}>{icon} {title} ({count})</span>
        <span style={{ fontSize: 11, color: '#3a4a5a' }}>{desc}</span>
      </div>
      {children}
    </div>
  )
}
