'use client'
import { useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

const NETS = [
  { key: 'youtube', label: 'YouTube', color: '#ff4444' },
  { key: 'instagram', label: 'Instagram', color: '#ff44cc' },
  { key: 'facebook', label: 'Facebook', color: '#4488ff' },
  { key: 'tiktok', label: 'TikTok', color: '#00f2ea' },
]
type Req = { status: string; result: Record<string, string> | null }

const chip = (color: string, on: boolean, dim = false): CSSProperties => ({
  fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: dim ? 'default' : 'pointer', whiteSpace: 'nowrap',
  border: `1px solid ${on ? color : '#1e2a40'}`, background: on ? color + '22' : '#0a1020',
  color: on ? color : dim ? '#2a3a4a' : '#7a8aa0', boxShadow: on ? `0 0 10px ${color}55` : 'none',
})

// Manual «Publicar»: tick networks (your «Mis redes» accounts) and the bot uploads this short right away.
export default function PublishButton({ jobId, published, connected }: {
  jobId: number; published: Record<string, string> | null; connected: string[]
}) {
  const done = published ?? {}
  const free = NETS.filter(n => connected.includes(n.key) && !done[n.key]).map(n => n.key)
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState<string[]>([])
  const [req, setReq] = useState<Req | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const busy = req?.status === 'pending' || req?.status === 'running'

  useEffect(() => {   // follow the request until the bot finishes it
    if (!busy) return
    const sb = createClient()
    const id = setInterval(async () => {
      const { data } = await sb.from('publish_requests').select('status,result').eq('job_id', jobId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (data) setReq(data as Req)
    }, 3000)
    return () => clearInterval(id)
  }, [busy, jobId])

  async function publish() {
    setErr(null)
    const r = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, platforms: pick }) })
    const b = await r.json().catch(() => ({}))
    if (!r.ok) return setErr(b.error ?? `Error ${r.status}`)
    setReq({ status: 'pending', result: null })
    setOpen(false)
  }

  const results = Object.entries(req?.result ?? {})
  return (
    <div style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
      {busy ? (
        <div style={{ fontSize: 11, color: '#ffaa00', fontFamily: 'monospace' }}>
          ⏳ {req?.status === 'running' ? 'el bot lo está subiendo…' : 'en cola — el bot lo sube en menos de 1 min'}
        </div>
      ) : open ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {NETS.map(n => {
            const isDone = !!done[n.key], linked = connected.includes(n.key), on = pick.includes(n.key)
            if (isDone) return <span key={n.key} style={chip(n.color, false, true)}>✓ {n.label}</span>
            if (!linked) return (
              <a key={n.key} href="/dashboard/connections" title="Conéctala en «Mis redes»"
                style={{ ...chip(n.color, false, true), textDecoration: 'none' }}>+ {n.label}</a>
            )
            return (
              <button key={n.key} style={chip(n.color, on)}
                onClick={() => setPick(p => on ? p.filter(x => x !== n.key) : [...p, n.key])}>
                {on ? '☑' : '☐'} {n.label}
              </button>
            )
          })}
          <button disabled={!pick.length} onClick={publish} style={{ fontSize: 11, fontWeight: 800, padding: '6px 14px',
            borderRadius: 8, border: 'none', cursor: pick.length ? 'pointer' : 'default', color: '#050810',
            background: pick.length ? 'linear-gradient(90deg,#00ff88,#00ccff)' : '#1a2235' }}>
            🚀 Publicar en {pick.length} {pick.length === 1 ? 'red' : 'redes'}
          </button>
          <button onClick={() => setOpen(false)} style={{ fontSize: 10, color: '#4a5a6a', background: 'none', border: 'none',
            cursor: 'pointer' }}>cancelar</button>
        </div>
      ) : free.length ? (
        <button onClick={() => { setPick(free); setOpen(true); setReq(null); setErr(null) }} style={{ fontSize: 11,
          fontWeight: 800, padding: '6px 14px', borderRadius: 8, border: '1px solid #00ff8855', cursor: 'pointer',
          background: '#00ff8814', color: '#00ff88', letterSpacing: .5 }}>🚀 Publicar</button>
      ) : !connected.length ? (
        <a href="/dashboard/connections" style={{ fontSize: 11, color: '#00aaff' }}>Conecta tus redes en «Mis redes» para publicar</a>
      ) : (
        <span style={{ fontSize: 10, color: '#2f7a55' }}>✓ publicado en todas tus redes conectadas</span>
      )}
      {err && <div style={{ fontSize: 11, color: '#ff6688', marginTop: 6 }}>✕ {err}</div>}
      {!busy && results.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6, fontSize: 11 }}>
          {results.map(([p, v]) => v.startsWith('error')
            ? <span key={p} style={{ color: '#ff6688' }}>✕ {p === '*' ? '' : `${p}: `}{v.replace(/^error: /, '')}</span>
            : <a key={p} href={v} target="_blank" rel="noreferrer" style={{ color: '#00ff88' }}>↗ {p}</a>)}
        </div>
      )}
    </div>
  )
}
