'use client'
import { useCallback, useEffect, useState } from 'react'

type Req = { id: number; status: string; found: number | null; message: string | null } | null

export default function SearchNowButton() {
  const [remaining, setRemaining] = useState<number | null>(null)
  const [cap, setCap] = useState<number | null>(null)
  const [req, setReq] = useState<Req>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = req?.status === 'pending' || req?.status === 'running'

  const refresh = useCallback(async () => {
    const [b, r] = await Promise.all([fetch('/api/search-budget').then(x => x.json()), fetch('/api/search-request').then(x => x.json())])
    if (typeof b.remaining === 'number') { setRemaining(b.remaining); setCap(b.cap) }
    setReq(r.request ?? null)
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, busy ? 4000 : 30000)
    return () => clearInterval(id)
  }, [refresh, busy])

  async function search() {
    setError(null)
    const res = await fetch('/api/search-request', { method: 'POST' })
    const body = await res.json()
    if (!res.ok) setError(body.error ?? 'Error')
    refresh()
  }

  const label = busy
    ? (req?.status === 'running' ? '🛰️ El bot está buscando…' : '⏳ En cola para el bot…')
    : '🔎 Buscar lives ahora'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button onClick={search} disabled={busy || (remaining ?? 0) < 2} style={{
        fontSize: 12, fontWeight: 700, letterSpacing: 1, padding: '10px 16px', borderRadius: 10, cursor: busy ? 'wait' : 'pointer',
        border: '1px solid #00ff8855', background: busy ? '#0a1020' : '#00ff8818', color: (remaining ?? 0) < 2 && !busy ? '#3a4a5a' : '#00ff88',
      }}>{label}</button>
      <div style={{ fontSize: 10, color: '#4a5a6a' }}>
        {remaining === null ? '…' : `Te quedan ${remaining} búsqueda(s) hoy${cap !== null ? ` de ${cap}` : ''} · cada una usa 2`}
        {req?.status === 'done' && !busy && <span style={{ color: '#00ff88' }}> · última: {req.message}</span>}
      </div>
      {error && <div style={{ fontSize: 10, color: '#ff6688' }}>{error}</div>}
    </div>
  )
}
