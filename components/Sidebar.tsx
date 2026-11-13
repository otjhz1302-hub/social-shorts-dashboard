'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import clsx from 'clsx'
import BotPowerButton from '@/components/BotPowerButton'

const NAV = [
  { href: '/dashboard',            label: 'Inicio',       icon: '⬡' },
  { href: '/dashboard/marketplace', label: 'Cortes',      icon: '✦' },
  { href: '/dashboard/connections', label: 'Mis redes',   icon: '⚭' },
  { href: '/dashboard/editor',     label: 'Editor Studio', icon: '✂' },
  { href: '/dashboard/lives',      label: 'Live Radar',   icon: '◉' },
  { href: '/dashboard/streamers',  label: 'Streamers',    icon: '♛' },
  { href: '/dashboard/queue',      label: 'Cola',         icon: '▣' },
  { href: '/dashboard/published',  label: 'Publicados',   icon: '▤' },
  { href: '/dashboard/analytics',  label: 'Analíticas',   icon: '▦' },
  { href: '/dashboard/users',      label: 'Usuarios',     icon: '▧', adminOnly: true },
  { href: '/dashboard/settings',   label: 'Configuración',icon: '▨', adminOnly: true },
]

export default function Sidebar({ role }: { role: string }) {
  const path = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const items = NAV.filter(n => !n.adminOnly || role === 'admin')

  return (
    <aside className="w-56 shrink-0 bg-surface border-r border-border flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-border">
        <div className="text-gold font-bold text-lg leading-none">Social Shorts</div>
        <div className="text-dim text-xs mt-1">Panel de control</div>
      </div>

      <nav className="flex-1 py-4 px-2 flex flex-col gap-1">
        {items.map(n => (
          <Link
            key={n.href} href={n.href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              path === n.href
                ? 'bg-gold/15 text-gold font-medium'
                : 'text-muted hover:bg-surface2 hover:text-white'
            )}
          >
            <span className="text-base">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        {role === 'admin' && <BotPowerButton />}
        <div className="text-xs text-dim mb-2 px-1">
          Rol: <span className={role === 'admin' ? 'text-gold' : 'text-muted'}>{role}</span>
        </div>
        <button
          onClick={logout}
          className="w-full text-left text-xs text-dim hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-400/10 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
