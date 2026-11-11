'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const ROLES = ['viewer', 'editor', 'admin']
const roleStyle: Record<string, string> = {
  admin:  'text-gold bg-gold/15 border-gold/30',
  editor: 'text-blue-400 bg-blue-400/15 border-blue-400/30',
  viewer: 'text-muted bg-muted/15 border-muted/30',
}

export default function UserRow({ user, currentUserId }: { user: any; currentUserId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const isMe = user.id === currentUserId

  async function changeRole(role: string) {
    setLoading(true)
    await supabase.from('profiles').update({ role }).eq('id', user.id)
    router.refresh()
    setLoading(false)
  }

  return (
    <tr className="border-b border-border/50 hover:bg-surface2">
      <td className="p-3">
        <span className="text-sm">{user.email}</span>
        {isMe && <span className="ml-2 text-xs text-dim">(tú)</span>}
      </td>
      <td className="p-3">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${roleStyle[user.role] ?? ''}`}>
          {user.role}
        </span>
      </td>
      <td className="p-3 text-muted hidden sm:table-cell">
        {new Date(user.created_at).toLocaleDateString('es')}
      </td>
      <td className="p-3">
        {!isMe && (
          <select
            value={user.role}
            onChange={e => changeRole(e.target.value)}
            disabled={loading}
            className="bg-surface2 border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-gold disabled:opacity-50"
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </td>
    </tr>
  )
}
