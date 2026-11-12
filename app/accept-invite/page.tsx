'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AcceptInvitePage() {
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle'|'loading'|'done'|'error'|'no-session'>('idle')
  const [msg, setMsg] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setStatus('no-session')
    })
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'USER_UPDATED') router.push('/dashboard')
      if (event === 'SIGNED_IN') setStatus('idle')
    })
  }, [])

  async function handleSet(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setStatus('error'); setMsg(error.message) }
    else { setStatus('done'); setMsg('¡Contraseña establecida! Redirigiendo...') }
  }

  if (status === 'no-session') return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-3xl font-bold text-gold mb-4">Social Shorts</div>
        <div className="bg-surface border border-border rounded-xl p-6">
          <p className="text-red-400 text-sm mb-2">Sesión no encontrada.</p>
          <p className="text-muted text-xs">Usa el enlace del email de invitación directamente. El enlace expira después de un uso.</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-gold mb-1">Social Shorts</div>
          <div className="text-muted text-sm">Acepta tu invitación</div>
        </div>
        <form onSubmit={handleSet} className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-4">
          <p className="text-sm text-muted">Establece tu contraseña para activar tu cuenta.</p>
          <div>
            <label className="block text-sm text-muted mb-1">Nueva contraseña</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
              placeholder="Mínimo 8 caracteres" minLength={8} required
            />
          </div>
          {msg && (
            <div className={`text-xs rounded-lg p-3 ${status === 'error' ? 'text-red-400 bg-red-400/10 border border-red-400/30' : 'text-green-400 bg-green-400/10 border border-green-400/30'}`}>
              {msg}
            </div>
          )}
          <button
            type="submit" disabled={status === 'loading' || status === 'done'}
            className="bg-gold text-black font-semibold rounded-lg py-2 text-sm hover:bg-gold-dim transition-colors disabled:opacity-50"
          >
            {status === 'loading' ? 'Guardando...' : 'Activar cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}
