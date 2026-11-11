'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ApproveButtons({ clipId }: { clipId: number }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function update(status: 'approved' | 'rejected') {
    setLoading(true)
    await supabase.from('clips').update({ status }).eq('id', clipId)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <button
        onClick={() => update('approved')} disabled={loading}
        className="px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
      >
        ✓ Aprobar
      </button>
      <button
        onClick={() => update('rejected')} disabled={loading}
        className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
      >
        ✕ Rechazar
      </button>
    </div>
  )
}
