'use client'
import { useCallback, useEffect, useState } from 'react'

type User = { id: string; email: string; role: string; search_daily_limit: number | null }
type Snapshot = {
  limits: { daily_total: number; bot_daily: number; guest_daily: number }
  used: Record<string, number>; total: number; users: User[]; tablesMissing: boolean
}

function Meter({ label, used, cap, color }: { label: string; used: number; cap: number; color: string }) {
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 100
  const hot = pct >= 85
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span style={{ color: hot ? '#ff6688' : color }}>{used} / {cap}</span>
      </div>
      <div className="h-2 rounded bg-surface2 overflow-hidden">
        <div style={{ width: `${pct}%`, background: hot ? '#ff3366' : color, height: '100%', transition: 'width .6s' }} />
      </div>
    </div>
  )
}

export default function SearchBudgetAdmin() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [form, setForm] = useState({ daily_total: 90, bot_daily: 60, guest_daily: 4 })
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/search-budget')
    if (!res.ok) return
    const s = (await res.json()) as Snapshot
    setSnap(s)
    setForm(s.limits)
  }, [])
  useEffect(() => { load() }, [load])

  async function save(body: object) {
    const res = await fetch('/api/search-budget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = await res.json()
    setMsg(res.ok ? 'Guardado ✓' : out.error)
    load()
  }

  if (!snap) return null
  const guests = snap.users.filter(u => u.role !== 'admin')
  return (
    <div className="bg-surface border border-border rounded-xl p-5 mt-6">
      <h2 className="text-sm font-semibold mb-1">🔎 Presupuesto diario de búsquedas de YouTube</h2>
      <p className="text-muted text-xs mb-4">
        Google permite ~100 búsquedas al día y se reinicia a medianoche (hora del Pacífico). El bot usa 2 por ronda de
        descubrimiento; cada “Buscar lives ahora” de un usuario usa 2. Nadie puede pasar su límite ni el total.
      </p>
      {snap.tablesMissing && <p className="text-xs text-gold mb-4">Ejecuta supabase/schema_studio.sql para activar el control.</p>}

      <div className="flex flex-col gap-3 mb-5">
        <Meter label="Total hoy" used={snap.total} cap={snap.limits.daily_total} color="#00aaff" />
        <Meter label="Bot" used={snap.used.bot ?? 0} cap={snap.limits.bot_daily} color="#00ff88" />
        {snap.users.map(u => (
          <Meter key={u.id} label={`${u.email}${u.role === 'admin' ? ' (admin)' : ''}`} used={snap.used[u.id] ?? 0}
            cap={u.role === 'admin' ? snap.limits.daily_total : (u.search_daily_limit ?? snap.limits.guest_daily)} color="#ffaa00" />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        {([['daily_total', 'Total diario'], ['bot_daily', 'Bot'], ['guest_daily', 'Por invitado']] as const).map(([k, label]) => (
          <label key={k} className="text-xs text-muted flex flex-col gap-1">
            {label}
            <input type="number" min={0} max={100} value={form[k]}
              onChange={e => setForm(f => ({ ...f, [k]: Number(e.target.value) }))}
              className="bg-surface2 border border-border rounded-lg px-3 py-2 text-white text-sm" />
          </label>
        ))}
      </div>
      <button onClick={() => save(form)} className="text-xs bg-gold/15 text-gold border border-gold/30 rounded-lg px-4 py-2">
        Guardar límites
      </button>

      {guests.length > 0 && (
        <div className="mt-5">
          <div className="text-xs text-muted mb-2">Límite individual por invitado (vacío = usa “Por invitado”)</div>
          {guests.map(u => (
            <div key={u.id} className="flex items-center gap-3 py-1.5 border-b border-border text-sm">
              <span className="flex-1 truncate">{u.email}</span>
              <input type="number" min={0} max={100} defaultValue={u.search_daily_limit ?? ''} placeholder={String(snap.limits.guest_daily)}
                onBlur={e => save({ user_id: u.id, search_daily_limit: e.target.value === '' ? null : Number(e.target.value) })}
                className="w-20 bg-surface2 border border-border rounded-lg px-2 py-1 text-white text-sm" />
            </div>
          ))}
        </div>
      )}
      {msg && <div className="text-xs mt-3 text-gold">{msg}</div>}
    </div>
  )
}
