'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────
type Moment = { start: number; end: number; hook?: string; confidence?: number }
type Frame = { url: string; score: number; chosen: boolean }
type PlatformSeo = { title?: string; description?: string; hashtags?: string[]; first_comment?: string }
type Job = {
  id: number; clip_id: number | null; source_id: string; source_title: string | null; channel: string | null
  source_duration: number | null; origin: string; viral_score: number | null
  score_breakdown: Record<string, number> | null; moments: Moment[] | null
  cut_start: number | null; cut_end: number | null; hook: string | null
  stage: string; progress: number | null; message: string | null
  title: string | null; description: string | null; hashtags: string[] | null
  seo: Record<string, PlatformSeo> | null; transcript: string | null
  video_url: string | null; cover_url: string | null; frames: Frame[] | null
  published: Record<string, string> | null; created_at: string; updated_at: string
}

const STAGES = [
  { key: 'queued',     label: 'Cola',       icon: '⏳', color: '#5a7a9a' },
  { key: 'scout',      label: 'Scout IA',   icon: '🔍', color: '#00aaff' },
  { key: 'download',   label: 'Descarga',   icon: '⬇️', color: '#00ccff' },
  { key: 'transcribe', label: 'Whisper',    icon: '🎙️', color: '#44ddff' },
  { key: 'edit',       label: 'Edición',    icon: '✂️', color: '#aa44ff' },
  { key: 'cover',      label: 'Portada',    icon: '🖼️', color: '#ff44cc' },
  { key: 'seo',        label: 'SEO',        icon: '🏷️', color: '#ffaa00' },
  { key: 'ready',      label: 'Listo',      icon: '✅', color: '#00ff88' },
  { key: 'publishing', label: 'Publicando', icon: '📤', color: '#00ff88' },
  { key: 'published',  label: 'Publicado',  icon: '🚀', color: '#00ff88' },
]
const ACTIVE = new Set(['scout', 'download', 'transcribe', 'edit', 'cover', 'seo', 'publishing'])
const CUTTING = new Set(['download', 'transcribe', 'edit'])
const BREAKDOWN: Record<string, string> = {
  velocity: 'Velocidad', outperform: 'vs Suscriptores', engagement: 'Engagement', hook: 'Gancho', fresh: 'Frescura',
}
const PLATFORM_COLOR: Record<string, string> = { youtube: '#ff4444', instagram: '#ff44cc', facebook: '#4488ff', tiktok: '#00f2ea' }
const STALE_MS = 15 * 60 * 1000

const stageOf = (k: string) => STAGES.find(s => s.key === k) ?? { key: k, label: k, icon: '❌', color: '#ff3366' }
const stageIdx = (k: string) => STAGES.findIndex(s => s.key === k)
const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
const mmss = (s: number | null | undefined) =>
  s == null ? '--:--' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
function ago(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 5) return 'ahora'
  if (d < 60) return `hace ${d}s`
  if (d < 3600) return `hace ${Math.floor(d / 60)}m`
  return `hace ${Math.floor(d / 3600)}h`
}

const CSS = `
@keyframes es-pulse { 0%,100%{box-shadow:0 0 0 0 var(--c)} 50%{box-shadow:0 0 0 10px transparent} }
@keyframes es-laser { from{left:0} to{left:100%} }
@keyframes es-flow { from{background-position:0 0} to{background-position:40px 0} }
@keyframes es-snip { 0%,100%{transform:translate(-50%,0) rotate(0)} 50%{transform:translate(-50%,0) rotate(-25deg)} }
@keyframes es-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
@keyframes es-shimmer { from{transform:translateX(-100%)} to{transform:translateX(100%)} }
@keyframes es-blink { 0%,100%{opacity:1} 50%{opacity:.35} }
@keyframes es-bars { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
.es-card{background:#080d14;border:1px solid #1a2235;border-radius:16px}
.es-label{font-size:10px;letter-spacing:2px;color:#3a4a5a;text-transform:uppercase}
.es-chip{display:inline-block;font-size:10px;padding:3px 8px;border-radius:999px;background:#0e1626;border:1px solid #1e2a40;color:#8fb0d0;margin:0 4px 4px 0}
.es-scroll::-webkit-scrollbar{height:4px;width:4px} .es-scroll::-webkit-scrollbar-thumb{background:#1a2a3a;border-radius:2px}
`

// ── Pieces ────────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 86 }: { score: number; size?: number }) {
  const r = size / 2 - 7, c = 2 * Math.PI * r
  const color = score >= 60 ? '#00ff88' : score >= 40 ? '#ffaa00' : '#ff6644'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#14203a" strokeWidth={6} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(score, 100) / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 6px ${color})` }} />
      <text x="50%" y="48%" textAnchor="middle" fill={color} fontSize={size / 4} fontWeight={900} fontFamily="monospace">
        {Math.round(score)}
      </text>
      <text x="50%" y="68%" textAnchor="middle" fill="#3a5a6a" fontSize={9} letterSpacing={1}>VIRAL</text>
    </svg>
  )
}

function PipelineLane({ jobs, current }: { jobs: Job[]; current: Job | null }) {
  const counts: Record<string, number> = {}
  jobs.forEach(j => { counts[j.stage] = (counts[j.stage] ?? 0) + 1 })
  const cur = current ? stageIdx(current.stage) : -1
  return (
    <div className="es-card es-scroll" style={{ padding: '18px 16px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 900 }}>
        {STAGES.map((s, i) => {
          const isCur = i === cur, done = cur >= 0 && i < cur
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < STAGES.length - 1 ? 1 : 0 }}>
              <div style={{ textAlign: 'center', width: 74 }}>
                <div style={{
                  ['--c' as string]: s.color + '88',
                  width: 46, height: 46, margin: '0 auto', borderRadius: 14, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 20, position: 'relative',
                  background: isCur ? s.color + '26' : done ? '#0d1f18' : '#0a1020',
                  border: `1px solid ${isCur ? s.color : done ? '#00ff8855' : '#1a2235'}`,
                  animation: isCur ? 'es-pulse 1.6s infinite' : 'none', transition: 'all .4s',
                }}>
                  {s.icon}
                  {!!counts[s.key] && (
                    <span style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, borderRadius: 9,
                      background: s.color, color: '#050810', fontSize: 10, fontWeight: 800, lineHeight: '18px', padding: '0 4px' }}>
                      {counts[s.key]}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, marginTop: 6, color: isCur ? s.color : done ? '#2f7a55' : '#3a4a5a', letterSpacing: 1 }}>
                  {s.label}
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div style={{
                  flex: 1, height: 3, borderRadius: 2, margin: '0 2px 18px',
                  background: done || isCur
                    ? `repeating-linear-gradient(90deg, ${s.color} 0 10px, transparent 10px 20px)`
                    : '#14203a',
                  backgroundSize: '40px 3px', opacity: done ? 0.5 : 1,
                  animation: isCur ? 'es-flow .6s linear infinite' : 'none',
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CutTimeline({ job }: { job: Job }) {
  const moments = job.moments ?? []
  const dur = job.source_duration || Math.max(job.cut_end ?? 0, ...moments.map(m => m.end), 60) + 30
  const pct = (s: number) => Math.min(100, Math.max(0, (s / dur) * 100))
  const cutting = CUTTING.has(job.stage)
  const hasCut = job.cut_start != null && job.cut_end != null
  return (
    <div>
      <div className="es-label" style={{ marginBottom: 8 }}>Línea de tiempo del video original</div>
      <div style={{ position: 'relative', height: 54, background: '#0a1020', borderRadius: 10, border: '1px solid #1a2235' }}>
        {Array.from({ length: 21 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', left: `${i * 5}%`, bottom: 0, width: 1, height: i % 5 ? 6 : 12, background: '#1e2a40' }} />
        ))}
        {moments.map((m, i) => (
          <div key={i} title={m.hook} style={{
            position: 'absolute', left: `${pct(m.start)}%`, width: `${Math.max(0.6, pct(m.end) - pct(m.start))}%`,
            top: 10, bottom: 10, background: '#00aaff1a', border: '1px dashed #00aaff66', borderRadius: 5,
          }} />
        ))}
        {hasCut && (
          <div style={{
            position: 'absolute', left: `${pct(job.cut_start!)}%`, width: `${Math.max(1, pct(job.cut_end!) - pct(job.cut_start!))}%`,
            top: 3, bottom: 3, borderRadius: 7, overflow: 'hidden',
            background: 'linear-gradient(90deg,#aa44ff66,#ff44cc66)', border: '1px solid #ff44cc',
            boxShadow: '0 0 22px #ff44cc77', transition: 'all .6s',
          }}>
            {cutting && <div style={{ position: 'absolute', top: 0, bottom: 0, width: 3, background: '#fff',
              boxShadow: '0 0 12px #fff, 0 0 24px #ff44cc', animation: 'es-laser 1.4s linear infinite' }} />}
          </div>
        )}
        {hasCut && [job.cut_start!, job.cut_end!].map((s, i) => (
          <span key={i} style={{ position: 'absolute', left: `${pct(s)}%`, top: -16, fontSize: 16,
            transform: 'translate(-50%,0)', animation: cutting ? 'es-snip .5s ease-in-out infinite' : 'none',
            filter: 'drop-shadow(0 0 6px #ff44cc)' }}>✂️</span>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#3a4a5a', fontFamily: 'monospace', marginTop: 6 }}>
        <span>0:00</span>
        {hasCut && (
          <span style={{ color: '#ff88dd' }}>
            ✂ {mmss(job.cut_start)} → {mmss(job.cut_end)} ({(job.cut_end! - job.cut_start!)}s) · {moments.length} candidato(s)
          </span>
        )}
        <span>{mmss(dur)}</span>
      </div>
    </div>
  )
}

function Stepper({ job }: { job: Job }) {
  const cur = stageIdx(job.stage)
  const failed = job.stage === 'failed'
  const pct = Math.round((job.progress ?? 0) * 100)
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 4 }}>
        {STAGES.slice(1).map((s, i) => {
          const idx = i + 1, done = idx < cur, isCur = idx === cur
          return (
            <div key={s.key} style={{ textAlign: 'center' }}>
              <div style={{ height: 4, borderRadius: 2, background: done ? '#00ff88' : isCur ? s.color : '#14203a',
                boxShadow: isCur ? `0 0 10px ${s.color}` : 'none', animation: isCur ? 'es-blink 1.2s infinite' : 'none' }} />
              <div style={{ fontSize: 13, marginTop: 6, opacity: done || isCur ? 1 : 0.3 }}>{done ? '✔' : s.icon}</div>
              <div style={{ fontSize: 8, color: isCur ? s.color : '#3a4a5a', letterSpacing: .5 }}>{s.label}</div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: failed ? '#1a0810' : '#0a1020',
        border: `1px solid ${failed ? '#ff336655' : '#1a2235'}`, fontFamily: 'monospace', fontSize: 12,
        color: failed ? '#ff6688' : stageOf(job.stage).color, animation: 'es-fade .3s' }} key={job.message}>
        {stageOf(job.stage).icon} {job.message ?? job.stage}
        {job.stage === 'edit' && <span style={{ float: 'right', color: '#fff', fontWeight: 800 }}>{pct}%</span>}
      </div>
      {job.stage === 'edit' && (
        <div style={{ height: 6, background: '#0a1020', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#aa44ff,#ff44cc)',
            boxShadow: '0 0 12px #ff44cc', transition: 'width 1.5s linear' }} />
        </div>
      )}
    </div>
  )
}

function Phone({ job, width = 230, hoverPlay = false }: { job: Job; width?: number; hoverPlay?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const pct = Math.round((job.progress ?? 0) * 100)
  return (
    <div style={{ width, aspectRatio: '9 / 16', borderRadius: width / 8, border: '3px solid #1e2a40', background: '#000',
      position: 'relative', overflow: 'hidden', boxShadow: '0 20px 60px #000a, 0 0 30px #aa44ff22', flexShrink: 0 }}
      onMouseEnter={() => hoverPlay && ref.current?.play().catch(() => {})}
      onMouseLeave={() => hoverPlay && ref.current?.pause()}>
      {job.video_url ? (
        <video ref={ref} src={job.video_url} poster={job.cover_url ?? undefined} muted loop playsInline
          autoPlay={!hoverPlay} preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : job.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={job.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ytThumb(job.source_id)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', filter: 'blur(14px) brightness(.45)', transform: 'scale(1.2)' }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ytThumb(job.source_id)} alt="" style={{ position: 'absolute', top: '30%', width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
          {job.hook && (
            <div style={{ position: 'absolute', top: '9%', left: '6%', right: '6%', textAlign: 'center', color: '#fff',
              fontFamily: 'Impact, Haettenschweiler, sans-serif', fontSize: width / 12, lineHeight: 1.1, textTransform: 'uppercase',
              textShadow: '0 0 4px #000, 2px 2px 0 #000, -2px -2px 0 #000' }}>{job.hook}</div>
          )}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,#ffffff18,transparent)',
              animation: 'es-shimmer 1.8s infinite' }} />
          </div>
          <div style={{ position: 'absolute', bottom: '12%', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 3, height: 26 }}>
            {Array.from({ length: 14 }, (_, i) => (
              <div key={i} style={{ width: 4, height: '100%', background: '#ff44cc', borderRadius: 2, transformOrigin: 'bottom',
                animation: `es-bars ${0.6 + (i % 4) * 0.15}s ease-in-out ${i * 0.05}s infinite` }} />
            ))}
          </div>
          <div style={{ position: 'absolute', bottom: '5%', left: 0, right: 0, textAlign: 'center', fontFamily: 'monospace',
            fontSize: 11, color: '#ff88dd', letterSpacing: 2 }}>
            {job.stage === 'edit' ? `RENDER ${pct}%` : stageOf(job.stage).label.toUpperCase()}
          </div>
        </>
      )}
      <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: '30%', height: 6,
        borderRadius: 3, background: '#000c' }} />
    </div>
  )
}

function ActivePanel({ job, live }: { job: Job; live: boolean }) {
  const breakdown = job.score_breakdown ?? {}
  return (
    <div className="es-card" style={{ padding: 20, display: 'grid', gridTemplateColumns: 'minmax(220px,280px) minmax(0,1fr) auto',
      gap: 22, alignItems: 'start', animation: 'es-fade .4s' }}>
      <div>
        <div className="es-label" style={{ marginBottom: 8 }}>{live ? '● Procesando ahora' : 'Último clip producido'}</div>
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #1a2235' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ytThumb(job.source_id)} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
          <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, letterSpacing: 1, padding: '3px 7px', borderRadius: 5,
            background: job.origin === 'live' ? '#ff3366' : '#00aaffcc', color: '#fff', fontWeight: 700 }}>
            {job.origin === 'live' ? '● LIVE' : 'VIDEO'}
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#c8d8ff', marginTop: 10, lineHeight: 1.35 }}>{job.source_title}</div>
        <div style={{ fontSize: 11, color: '#4a5a6a', marginTop: 3 }}>{job.channel} · {mmss(job.source_duration)}</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 14 }}>
          <ScoreRing score={job.viral_score ?? 0} />
          <div style={{ flex: 1 }}>
            {Object.entries(BREAKDOWN).map(([k, label]) => (
              <div key={k} style={{ marginBottom: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#4a5a6a' }}>
                  <span>{label}</span><span>{Math.round((breakdown[k] ?? 0) * 100)}</span>
                </div>
                <div style={{ height: 3, background: '#0e1626', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${(breakdown[k] ?? 0) * 100}%`, background: '#00aaff', borderRadius: 2,
                    transition: 'width 1s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <CutTimeline job={job} />
        {job.hook && (
          <div>
            <div className="es-label" style={{ marginBottom: 6 }}>Gancho en pantalla</div>
            <div style={{ fontFamily: 'Impact, Haettenschweiler, sans-serif', fontSize: 26, textTransform: 'uppercase',
              color: '#fff', letterSpacing: .5, textShadow: '0 0 18px #ffd40066, 2px 2px 0 #000' }}>{job.hook}</div>
          </div>
        )}
        <Stepper job={job} />
        {job.title && (
          <div style={{ animation: 'es-fade .4s' }}>
            <div className="es-label" style={{ marginBottom: 6 }}>Título SEO generado</div>
            <div style={{ fontSize: 14, color: '#e8f0ff', fontWeight: 600 }}>{job.title}</div>
            <div style={{ marginTop: 8 }}>{(job.hashtags ?? []).slice(0, 14).map(h => <span key={h} className="es-chip">#{h}</span>)}</div>
          </div>
        )}
      </div>

      <Phone job={job} />
    </div>
  )
}

function ClipCard({ job }: { job: Job }) {
  const platforms = Object.keys(job.seo ?? {})
  const [tab, setTab] = useState(platforms[0] ?? 'youtube')
  const [open, setOpen] = useState(false)
  const seo: PlatformSeo = job.seo?.[tab] ?? { title: job.title ?? '', description: job.description ?? '', hashtags: job.hashtags ?? [] }
  const published = job.published ?? {}
  return (
    <div className="es-card" style={{ padding: 16, display: 'flex', gap: 16, animation: 'es-fade .4s' }}>
      <Phone job={job} width={150} hoverPlay />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, letterSpacing: 1, padding: '3px 8px', borderRadius: 5, fontWeight: 700,
            background: job.stage === 'published' ? '#00ff8822' : '#ffaa0022', color: job.stage === 'published' ? '#00ff88' : '#ffaa00' }}>
            {job.stage === 'published' ? '🚀 PUBLICADO' : '✅ LISTO · EN COLA DE PUBLICACIÓN'}
          </span>
          <span style={{ fontSize: 10, color: '#4a5a6a', fontFamily: 'monospace' }}>
            {Math.round(job.viral_score ?? 0)} pts · {ago(job.updated_at)}
          </span>
          {Object.entries(published).map(([p, url]) => (
            <a key={p} href={url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: PLATFORM_COLOR[p] ?? '#8fb0d0' }}>↗ {p}</a>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {platforms.map(p => (
            <button key={p} onClick={() => setTab(p)} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${tab === p ? PLATFORM_COLOR[p] ?? '#00aaff' : '#1a2235'}`,
              background: tab === p ? (PLATFORM_COLOR[p] ?? '#00aaff') + '22' : 'transparent',
              color: tab === p ? PLATFORM_COLOR[p] ?? '#00aaff' : '#4a5a6a' }}>{p}</button>
          ))}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e8f0ff', lineHeight: 1.35 }}>{seo.title}</div>
        <div style={{ marginTop: 8 }}>{(seo.hashtags ?? []).slice(0, 18).map(h => <span key={h} className="es-chip">#{h}</span>)}</div>
        <div style={{ fontSize: 11, color: '#7a8aa0', marginTop: 6, whiteSpace: 'pre-wrap', maxHeight: open ? 'none' : 54, overflow: 'hidden' }}>
          {seo.description}
        </div>
        {seo.first_comment && <div style={{ fontSize: 11, color: '#00ccff', marginTop: 6 }}>💬 {seo.first_comment}</div>}
        {!!job.frames?.length && (
          <div style={{ marginTop: 10 }}>
            <div className="es-label" style={{ marginBottom: 6 }}>Portada · frames analizados</div>
            <div className="es-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {job.frames.map((f, i) => (
                <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" style={{ width: 44, aspectRatio: '9/16', objectFit: 'cover', borderRadius: 5,
                    border: `2px solid ${f.chosen ? '#00ff88' : '#1a2235'}`, opacity: f.chosen ? 1 : 0.55,
                    boxShadow: f.chosen ? '0 0 12px #00ff8888' : 'none' }} />
                  <div style={{ fontSize: 8, textAlign: 'center', color: f.chosen ? '#00ff88' : '#3a4a5a', fontFamily: 'monospace' }}>
                    {f.chosen ? '★ ' : ''}{Math.round(f.score * 100)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {open && job.transcript && (
          <div style={{ fontSize: 11, color: '#5a7a8a', marginTop: 10, fontStyle: 'italic' }}>🎙️ “{job.transcript}”</div>
        )}
        <button onClick={() => setOpen(o => !o)} style={{ marginTop: 8, fontSize: 10, color: '#00aaff', background: 'none',
          border: 'none', cursor: 'pointer', padding: 0 }}>{open ? '▲ menos' : '▼ descripción completa y transcripción'}</button>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function EditorStudio() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [bot, setBot] = useState<{ task: string; alive: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const poll = useCallback(async () => {
    const sb = createClient()
    const [j, s] = await Promise.all([
      sb.from('pipeline_jobs').select('*').order('updated_at', { ascending: false }).limit(60),
      sb.from('bot_status').select('last_seen,current_task').eq('id', 1).single(),
    ])
    if (j.error) setError(j.error.message)
    else { setError(null); setJobs(j.data as Job[]) }
    if (s.data) setBot({ task: s.data.current_task, alive: Date.now() - new Date(s.data.last_seen).getTime() < 180_000 })
    setTick(t => t + 1)
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [poll])

  const fresh  = (j: Job) => Date.now() - new Date(j.updated_at).getTime() < STALE_MS
  const active = jobs.find(j => ACTIVE.has(j.stage) && fresh(j)) ?? null
  const queued = jobs.filter(j => j.stage === 'queued' && fresh(j))
  const done   = jobs.filter(j => j.stage === 'ready' || j.stage === 'published')
  const failed = jobs.filter(j => j.stage === 'failed').slice(0, 6)
  const focus  = active ?? done[0] ?? null
  const laneJobs = jobs.filter(j => fresh(j) || j.stage === 'ready')

  return (
    <div style={{ background: '#050810', minHeight: '100vh', color: '#c8d8ff', padding: '22px 24px' }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3, background: 'linear-gradient(90deg,#aa44ff,#ff44cc,#00aaff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>✂️ EDITOR STUDIO</div>
            <div style={{ fontSize: 10, color: '#3a4a5a', letterSpacing: 2, marginTop: 2 }}>
              PIPELINE EN VIVO · SELECTOR → SCOUT → CORTE → EDICIÓN → PORTADA → SEO → PUBLICACIÓN · SYNC #{tick}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999,
            background: bot?.alive ? '#00ff8811' : '#0a1020', border: `1px solid ${bot?.alive ? '#00ff8855' : '#1a2235'}` }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: bot?.alive ? '#00ff88' : '#2a3a4a',
              animation: bot?.alive ? 'es-blink 1.2s infinite' : 'none' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: bot?.alive ? '#00ff88' : '#3a4a5a' }}>
              {bot?.alive ? (bot.task || 'activo').toUpperCase() : 'BOT OFFLINE'}
            </span>
          </div>
        </div>

        {error && (
          <div className="es-card" style={{ padding: 16, borderColor: '#ffaa0055', color: '#ffcc66', fontSize: 12 }}>
            ⚠️ No se pudo leer <code>pipeline_jobs</code> ({error}). Ejecuta <code>supabase/schema_studio.sql</code> en el SQL Editor de Supabase.
          </div>
        )}

        <PipelineLane jobs={laneJobs} current={active} />

        {focus ? <ActivePanel job={focus} live={!!active} /> : (
          <div className="es-card" style={{ padding: 50, textAlign: 'center', color: '#2a3a4a' }}>
            <div style={{ fontSize: 40, animation: 'es-blink 2s infinite' }}>✂️</div>
            <div style={{ letterSpacing: 2, fontSize: 12, marginTop: 10 }}>ESPERANDO EL PRÓXIMO VIDEO DEL SELECTOR</div>
            <div style={{ fontSize: 11, marginTop: 6 }}>Cuando el bot elija un video aparecerá aquí cortándose en vivo.</div>
          </div>
        )}

        {queued.length > 0 && (
          <div>
            <div className="es-label" style={{ marginBottom: 10 }}>● Cola del selector ({queued.length})</div>
            <div className="es-scroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {queued.map((j, i) => (
                <div key={j.id} className="es-card" style={{ width: 230, flexShrink: 0, overflow: 'hidden', animation: `es-fade .3s ${i * 0.05}s both` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ytThumb(j.source_id)} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: '#c8d8ff', height: 30, overflow: 'hidden' }}>{j.source_title}</div>
                    <div style={{ fontSize: 10, color: '#00ff88', fontFamily: 'monospace', marginTop: 4 }}>
                      #{i + 1} · {Math.round(j.viral_score ?? 0)} pts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="es-label" style={{ marginBottom: 10 }}>● Clips producidos ({done.length}) — pasa el mouse para reproducir</div>
          {done.length === 0 ? (
            <div className="es-card" style={{ padding: 30, textAlign: 'center', color: '#2a3a4a', fontSize: 12 }}>Aún no hay clips terminados.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 14 }}>
              {done.slice(0, 12).map(j => <ClipCard key={j.id} job={j} />)}
            </div>
          )}
        </div>

        {failed.length > 0 && (
          <div>
            <div className="es-label" style={{ marginBottom: 10 }}>● Descartados / fallidos</div>
            <div className="es-card" style={{ padding: 6 }}>
              {failed.map(j => (
                <div key={j.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 10px', fontSize: 11, borderBottom: '1px solid #0d1525' }}>
                  <span style={{ color: '#ff6688' }}>✕</span>
                  <span style={{ flex: 1, color: '#7a8aa0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.source_title}</span>
                  <span style={{ color: '#ff6688', fontFamily: 'monospace' }}>{j.message}</span>
                  <span style={{ color: '#2a3a4a' }}>{ago(j.updated_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
