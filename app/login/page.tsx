'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-gold mb-1">Social Shorts</div>
          <div className="text-muted text-sm">Panel de administración</div>
        </div>
        <form onSubmit={handleLogin} className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
              placeholder="tu@email.com" required
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Contraseña</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
              placeholder="••••••••" required
            />
          </div>
          {error && <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/30 rounded-lg p-3">{error}</div>}
          <button
            type="submit" disabled={loading}
            className="bg-gold text-black font-semibold rounded-lg py-2 text-sm hover:bg-gold-dim transition-colors disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
