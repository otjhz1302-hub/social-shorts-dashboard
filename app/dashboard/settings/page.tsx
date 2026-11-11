import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Configuración</h1>
      <p className="text-muted text-sm mb-8">Las claves de API y la configuración del scheduler se gestionan en el archivo <code className="text-gold bg-gold/10 px-1 rounded">.env</code> de la carpeta del proyecto en tu laptop.</p>

      <div className="flex flex-col gap-4">
        {[
          { title: 'Anthropic / Claude', key: 'ANTHROPIC_API_KEY', desc: 'Para generar títulos, descripciones y detectar mejores clips' },
          { title: 'Supabase', key: 'SUPABASE_URL + SUPABASE_SERVICE_KEY', desc: 'Base de datos del proyecto (ya configurado si ves este panel)' },
          { title: 'Cloudflare R2', key: 'R2_ACCOUNT_ID + R2_ACCESS_KEY + ...', desc: 'Almacenamiento de los clips procesados' },
          { title: 'YouTube', key: 'YOUTUBE_API_KEY + client_secrets.json', desc: 'Detección de tendencias y subida de Shorts' },
          { title: 'Instagram', key: 'INSTAGRAM_USERNAME + INSTAGRAM_PASSWORD', desc: 'Subida de Reels automática' },
          { title: 'Facebook', key: 'FACEBOOK_ACCESS_TOKEN + FACEBOOK_PAGE_ID', desc: 'Publicación en tu Página de Facebook' },
          { title: 'TikTok', key: 'TIKTOK_CLIENT_KEY + TIKTOK_CLIENT_SECRET', desc: 'Requiere aprobación del Content Posting API' },
        ].map(item => (
          <div key={item.title} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="font-medium text-sm mb-0.5">{item.title}</div>
                <div className="text-muted text-xs">{item.desc}</div>
              </div>
              <code className="text-xs text-gold bg-gold/10 px-2 py-1 rounded shrink-0">{item.key}</code>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-gold/10 border border-gold/30 rounded-xl p-4 text-sm text-muted">
        <strong className="text-gold block mb-1">¿Cómo actualizar configuración?</strong>
        Edita el archivo <code className="text-gold">.env</code> en la carpeta <code className="text-gold">Social Shorts</code> de tu Desktop y reinicia el scheduler con <code className="text-gold">run_backend.bat</code>.
      </div>
    </div>
  )
}
