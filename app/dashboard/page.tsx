import { createAdminClient } from '@/lib/supabase/server'
import LiveDashboard from '@/components/LiveDashboard'

export default async function DashboardPage() {
  const admin = createAdminClient()
  const [videos, clips, queue, done, failed] = await Promise.all([
    admin.from('videos').select('id', { count: 'exact', head: true }),
    admin.from('clips').select('id', { count: 'exact', head: true }),
    admin.from('clips').select('id', { count: 'exact', head: true }).in('status', ['ready', 'approved']),
    admin.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'done'),
    admin.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  ])

  return (
    <LiveDashboard initialStats={{
      videos: videos.count ?? 0,
      clips:  clips.count  ?? 0,
      queue:  queue.count  ?? 0,
      done:   done.count   ?? 0,
      failed: failed.count ?? 0,
    }} />
  )
}
