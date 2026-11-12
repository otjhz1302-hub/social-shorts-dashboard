'use client'
import { Fragment, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = { platform: string; hour: number; score: number; prior: number; samples: number }

// Same prior curve as core/timing.py (audience clock, US Eastern by default)
const PRIOR = [0.25, 0.18, 0.12, 0.08, 0.06, 0.07, 0.15, 0.30, 0.40, 0.45, 0.50, 0.62,
  0.75, 0.80, 0.74, 0.70, 0.72, 0.82, 0.92, 1.00, 1.00, 0.93, 0.70, 0.45]
const PLATFORMS = [
  { key: 'youtube', label: 'YouTube', color: '255,68,68' },
  { key: 'instagram', label: 'Instagram', color: '255,68,204' },
  { key: 'facebook', label: 'Facebook', color: '68,136,255' },
  { key: 'tiktok', label: 'TikTok', color: '0,242,234' },
]
const AUDIENCE_UTC_OFFSET = -5

export default function PostingHours() {
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => {
    createClient().from('posting_hours').select('platform,hour,score,prior,samples')
      .then(({ data }) => setRows((data as Row[]) ?? []))
  }, [])

  const nowHour = (new Date().getUTCHours() + 24 + AUDIENCE_UTC_OFFSET) % 24
  const learned = rows.some(r => r.samples > 0)
  const cell = (p: string, h: number) => rows.find(r => r.platform === p && r.hour === h) ?? { score: PRIOR[h], samples: 0 }

  return (
    <div style={{ background: '#080d14', border: '1px solid #1a2235', borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#3a4a5a' }}>⏰ MEJORES HORAS PARA PUBLICAR · HORA DE LA AUDIENCIA (EE. UU. ESTE)</div>
        <div style={{ fontSize: 10, color: learned ? '#00ff88' : '#ffaa00' }}>
          {learned ? 'Curva aprendida de las vistas reales de nuestros clips' : 'Curva inicial: se ajusta sola cuando haya vistas de nuestros clips'}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(24, minmax(22px, 1fr))', gap: 3, minWidth: 700 }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} style={{ fontSize: 9, textAlign: 'center', color: h === nowHour ? '#fff' : '#3a4a5a', fontWeight: h === nowHour ? 800 : 400 }}>
              {h}
            </div>
          ))}
          {PLATFORMS.map(p => (
            <Fragment key={p.key}>
              <div style={{ fontSize: 10, color: `rgb(${p.color})`, alignSelf: 'center' }}>{p.label}</div>
              {Array.from({ length: 24 }, (_, h) => {
                const c = cell(p.key, h)
                return (
                  <div key={`${p.key}-${h}`} title={`${p.label} ${h}:00 · score ${Math.round(c.score * 100)} · ${c.samples} clip(s)`}
                    style={{ height: 26, borderRadius: 4, background: `rgba(${p.color},${0.08 + c.score * 0.8})`,
                      outline: h === nowHour ? '1px solid #fff' : 'none', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 8, color: '#ffffffaa' }}>
                    {c.samples > 0 ? c.samples : ''}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#3a4a5a', marginTop: 10 }}>
        El bot publica solo en las mejores horas que quedan del día para los clips pendientes; el número en cada celda indica cuántos clips nuestros alimentan esa hora.
      </div>
    </div>
  )
}
