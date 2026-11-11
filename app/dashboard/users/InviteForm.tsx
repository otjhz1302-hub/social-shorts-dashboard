'use client'
import { useState } from 'react'

export default function InviteForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle'|'loading'|'done'|'error'>('idle')
  const [msg, setMsg] = useState('')

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading'); setMsg('')
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (res.ok) {
      setStatus('done')
      setMsg(`Invitación enviada a ${email}`)
      setEmail('')
    } else {
      setStatus('error')
      setMsg(data.error ?? 'Error al enviar invitación')
    }
  }

  return (
    <form onSubmit={handleInvite} className="flex gap-2 items-end flex-wrap">
      <div className="flex-1 min-w-48">
        <label className="block text-xs text-muted mb-1">Email del colaborador</label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="colaborador@email.com" required
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
        />
      </div>
      <button
        type="submit" disabled={status === 'loading'}
        className="bg-gold text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-gold-dim transition-colors disabled:opacity-50 shrink-0"
      >
        {status === 'loading' ? 'Enviando...' : 'Enviar invitación'}
      </button>
      {msg && (
        <div className={`w-full text-xs rounded-lg p-2 mt-1 ${status === 'error' ? 'text-red-400 bg-red-400/10' : 'text-green-400 bg-green-400/10'}`}>
          {msg}
        </div>
      )}
    </form>
  )
}
