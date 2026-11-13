'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import clsx from 'clsx'
import PublishButton from '@/components/PublishButton'

type Niche = { id: number; name: string; keywords: string[] }
type Discovery = {
  id: number; niche_id: number; kind: string; source_id: string; source_url: string | null; title: string | null
  channel: string | null; views: number | null; duration: number | null; viral_score: number | null; hook: string | null
  payload: { cover_url?: string; origin?: string } | null
}
type Job = {
  id: number; discovery_id: number | null; source_id: string; source_title: string | null; stage: string
  message: string | null; progress: number | null; published: Record<string, string> | null; created_at: string
}

const ACTIVE = ['queued', 'scout', 'download', 'transcribe', 'edit', 'cover', 'seo', 'ready', 'publishing']
const fmt = (n?: number | null) => (n ?? 0) >= 1e6 ? `${((n ?? 0) / 1e6).toFixed(1)}M` : (n ?? 0) >= 1e3 ? `${Math.round((n ?? 0) / 1e3)}K` : String(n ?? 0)
const mmss = (s?: number | null) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : ''

export default function Marketplace({ niches, picked, discoveries, jobs, platforms, quota }: {
  niches: Niche[]; picked: number[]; discoveries: Discovery[]; jobs: Job[]; platforms: string[]
  quota: { cap: number | null; used: number }
}) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState<number | 'all'>('all')
  const requested = new Set(jobs.filter(j => j.stage !== 'failed').map(j => j.discovery_id))
  const running = jobs.some(j => ACTIVE.includes(j.stage))
  const left = quota.cap === null ? Infinity : quota.cap - quota.used

  useEffect(() => {   // live progress of my clips
    if (!running) return
    const id = setInterval(() => router.refresh(), 8000)
    return () => clearInterval(id)
  }, [running, router])

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key); setMsg(null)
    try { setMsg({ ok: true, text: await fn() }) } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
    setBusy(null); router.refresh()
  }
  const post = async (url: string, body: object) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const b = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(b.error ?? `Error ${r.status}`)
    return b
  }

  const toggleNiche = (n: Niche) => run(`n${n.id}`, async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const q = supabase.from('user_niches')
    const { error } = picked.includes(n.id)
      ? await q.delete().eq('user_id', user!.id).eq('niche_id', n.id)
      : await q.insert({ user_id: user!.id, niche_id: n.id })
    if (error) throw new Error(error.message)
    return picked.includes(n.id) ? `Quitaste ${n.name}` : `Agregaste ${n.name} — el bot buscará videos de este nicho`
  })

  const shown = discoveries.filter(d => filter === 'all' || d.niche_id === filter)
  const nicheName = (id: number) => niches.find(n => n.id === id)?.name ?? ''

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Cortes</h1>
          <p className="text-muted text-sm">Elige tus nichos, aprueba un video y el bot lo edita y lo publica en tus redes. Cada video es exclusivo: cuando alguien lo toma, desaparece para los demás.</p>
        </div>
        <div className="text-xs text-muted text-right">
          {quota.cap === null ? 'Sin límite diario (admin)' : <>Cortes hoy: <span className={left > 0 ? 'text-gold' : 'text-red-400'}>{quota.used}/{quota.cap}</span></>}
          <div className="mt-1">
            Publicará en: {platforms.length
              ? <span className="text-white capitalize">{platforms.join(', ')}</span>
              : <Link href="/dashboard/connections" className="text-gold hover:underline">conecta tus redes →</Link>}
          </div>
        </div>
      </div>

      {msg && <div className={clsx('mb-4 rounded-lg border text-sm p-3', msg.ok
        ? 'border-green-400/30 bg-green-400/10 text-green-400' : 'border-red-400/30 bg-red-400/10 text-red-400')}>{msg.text}</div>}

      <section className="bg-surface border border-border rounded-xl p-4 mb-6">
        <div className="text-sm font-semibold mb-3">Mis nichos</div>
        <div className="flex flex-wrap gap-2">
          {niches.map(n => (
            <button key={n.id} onClick={() => toggleNiche(n)} disabled={busy !== null} title={n.keywords.slice(0, 6).join(', ')}
              className={clsx('text-xs px-3 py-1.5 rounded-full border transition-colors', picked.includes(n.id)
                ? 'bg-gold/15 text-gold border-gold/40' : 'text-muted border-border hover:text-white')}>
              {picked.includes(n.id) ? '✓ ' : '+ '}{n.name}
            </button>
          ))}
          {!niches.length && <span className="text-xs text-dim">El admin aún no creó nichos.</span>}
        </div>
        {picked.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
            {picked.map(id => (
              <button key={id} disabled={busy !== null}
                onClick={() => run(`s${id}`, async () => { await post('/api/search-request', { kind: 'videos', niche_id: id }); return `Búsqueda en cola: ${nicheName(id)}. Los videos aparecerán aquí en unos minutos.` })}
                className="text-xs px-3 py-1.5 rounded-lg border border-green-400/30 text-green-400 hover:bg-green-400/10">
                🔎 Buscar videos de {nicheName(id)} ahora
              </button>
            ))}
          </div>
        )}
      </section>

      {jobs.length > 0 && (
        <section className="mb-6">
          <div className="text-sm font-semibold mb-2">Mis cortes</div>
          <div className="bg-surface border border-border rounded-xl divide-y divide-border/50">
            {jobs.map(j => (
              <div key={j.id} className="p-3 flex items-center gap-3 text-sm">
                <img src={`https://i.ytimg.com/vi/${j.source_id}/default.jpg`} alt="" className="w-16 h-9 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{j.source_title}</div>
                  <div className="text-xs text-muted truncate">{j.message}</div>
                  {['ready', 'published'].includes(j.stage) && (
                    <PublishButton jobId={j.id} published={j.published} connected={platforms} />
                  )}
                </div>
                {j.published && Object.entries(j.published).map(([p, u]) => (
                  <a key={p} href={u} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:underline capitalize">{p} →</a>
                ))}
                <span className={clsx('text-xs px-2 py-0.5 rounded-full border', j.stage === 'published'
                  ? 'text-green-400 border-green-400/30' : j.stage === 'failed' ? 'text-red-400 border-red-400/30' : 'text-gold border-gold/30')}>
                  {j.stage === 'published' ? 'publicado' : j.stage === 'failed' ? 'falló' : j.stage === 'queued' ? 'en cola' : `${Math.round((j.progress ?? 0) * 100)}%`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Descubiertos por el bot</div>
          {picked.length > 1 && (
            <select value={filter} onChange={e => setFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-surface border border-border rounded-lg text-xs px-2 py-1">
              <option value="all">Todos mis nichos</option>
              {picked.map(id => <option key={id} value={id}>{nicheName(id)}</option>)}
            </select>
          )}
        </div>
        {!picked.length ? (
          <div className="bg-surface border border-border rounded-xl p-10 text-center text-muted text-sm">Elige al menos un nicho para ver videos.</div>
        ) : !shown.length ? (
          <div className="bg-surface border border-border rounded-xl p-10 text-center text-muted text-sm">
            Aún no hay videos. El bot busca cada 6 h, o usa «Buscar videos ahora».
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map(d => {
              const done = requested.has(d.id)
              return (
                <div key={d.id} className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
                  <a href={d.source_url ?? '#'} target="_blank" rel="noopener noreferrer" className="relative block">
                    <img src={d.payload?.cover_url || `https://i.ytimg.com/vi/${d.source_id}/hqdefault.jpg`} alt=""
                      onError={e => { e.currentTarget.src = `https://i.ytimg.com/vi/${d.source_id}/hqdefault.jpg` }}
                      className="w-full aspect-video object-cover" />
                    <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-black/70 text-gold">
                      {d.kind === 'clip' ? `✂ YA EDITADO${d.payload?.origin === 'live' ? ' · LIVE' : ''} · ` : ''}{Math.round(d.viral_score ?? 0)} pts
                    </span>
                    {d.duration ? <span className="absolute bottom-2 right-2 text-[10px] px-1.5 rounded bg-black/70">{mmss(d.duration)}</span> : null}
                  </a>
                  <div className="p-3 flex-1 flex flex-col gap-1">
                    <div className="text-sm font-medium line-clamp-2">{d.title}</div>
                    <div className="text-xs text-muted">{d.channel}{d.views ? ` · ${fmt(d.views)} vistas` : ''}</div>
                    {d.hook && <div className="text-xs text-dim italic truncate">“{d.hook}”</div>}
                    <button disabled={done || busy !== null || left <= 0 || !platforms.length}
                      onClick={() => run(`d${d.id}`, async () => { await post('/api/marketplace/clip', { discovery_id: d.id }); return 'Corte en cola: el bot lo editará y lo publicará en tus redes.' })}
                      className={clsx('mt-auto text-xs font-semibold px-3 py-2 rounded-lg border', done
                        ? 'text-green-400 border-green-400/30 cursor-default'
                        : 'text-gold border-gold/40 bg-gold/10 hover:bg-gold/20 disabled:opacity-40 disabled:cursor-not-allowed')}>
                      {done ? '✓ Pedido' : busy === `d${d.id}` ? 'Enviando…' : d.kind === 'clip' ? '⚡ Tomarlo y publicar' : '✂ Crear corte y publicar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
