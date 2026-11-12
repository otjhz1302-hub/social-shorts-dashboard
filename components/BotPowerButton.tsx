'use client'
import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'

type Status = { enabled?: boolean; is_running?: boolean; last_seen?: string; current_task?: string; error?: string }

// Admin switch: turns the bot's work on/off. It can't start the program itself (it runs on the admin's PC),
// so it also says whether the program is alive (heartbeat in the last 3 minutes).
export default function BotPowerButton() {
  const [s, setS] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/bot', { cache: 'no-store' })
    setS(await r.json().catch(() => ({ error: 'Error' })))
  }, [])
  useEffect(() => { load(); const id = setInterval(load, 10_000); return () => clearInterval(id) }, [load])

  async function toggle() {
    if (!s || busy) return
    setBusy(true)
    const r = await fetch('/api/bot', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !s.enabled }) })
    const b = await r.json().catch(() => ({}))
    if (!r.ok) setS({ ...s, error: b.error ?? 'Error' })
    await load()
    setBusy(false)
  }

  if (!s) return <div className="text-xs text-dim px-1 mb-2">Bot…</div>
  if (s.error) return <div className="text-[11px] text-red-400 px-1 mb-2">{s.error}</div>

  const alive = !!s.last_seen && Date.now() - new Date(s.last_seen).getTime() < 3 * 60_000
  const on = s.enabled !== false
  return (
    <div className="mb-3">
      <button onClick={toggle} disabled={busy} role="switch" aria-checked={on}
        className={clsx('w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors',
          on ? 'border-green-400/40 bg-green-400/10 text-green-400 hover:bg-green-400/20'
             : 'border-red-400/40 bg-red-400/10 text-red-400 hover:bg-red-400/20', busy && 'opacity-60 cursor-wait')}>
        <span>{busy ? 'Cambiando…' : on ? '⏻ Bot encendido' : '⏻ Bot apagado'}</span>
        <span className={clsx('w-9 h-5 rounded-full relative transition-colors', on ? 'bg-green-400/60' : 'bg-dim/60')}>
          <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', on ? 'left-[18px]' : 'left-0.5')} />
        </span>
      </button>
      <div className="text-[11px] text-dim mt-1 px-1 leading-snug">
        {alive
          ? <>PC: <span className="text-muted">{s.current_task}</span></>
          : <span className="text-gold">El programa no está corriendo en tu PC — ábrelo con run_backend.bat</span>}
      </div>
    </div>
  )
}
