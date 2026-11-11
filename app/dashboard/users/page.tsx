import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InviteForm from './InviteForm'
import UserRow from './UserRow'

export default async function UsersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, role, created_at')
    .order('created_at', { ascending: true })

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Gestión de usuarios</h1>
      <p className="text-muted text-sm mb-8">Invita colaboradores y gestiona sus permisos de acceso al panel.</p>

      {/* Invitar usuario */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold mb-1">Invitar por email</h2>
        <p className="text-muted text-xs mb-4">
          El usuario recibirá un email con un enlace para activar su cuenta. Por defecto se asigna el rol <span className="text-gold">viewer</span>.
        </p>
        <InviteForm />
      </div>

      {/* Lista de usuarios */}
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Usuarios activos</h2>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {(!users || users.length === 0) ? (
          <div className="p-6 text-center text-muted text-sm">No hay usuarios aún.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs">
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Rol</th>
                <th className="text-left p-3 hidden sm:table-cell">Registrado</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <UserRow key={u.id} user={u} currentUserId={user.id} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
