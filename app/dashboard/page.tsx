import { createAdminClient } from '@/lib/supabase/server'
import LiveDashboard from '@/components/LiveDashboard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const admin = createAdminClient()
  const [videos, clips, queue, done, failed, quota, streamers] = await Promise.all([
    admin.from('videos').select('id', { count: 'exact', head: true }),
    admin.from('clips').select('id', { count: 'exact', head: true }),
    admin.from('clips').select('id', { count: 'exact', head: true }).in('status', ['ready', 'approved', 'queued']),
    admin.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'done'),
    admin.from('uploads').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    admin.from('daily_quota').select('count').eq('date', new Date().toISOString().slice(0, 10)).maybeSingle(),
    admin.from('streamers').select('id', { count: 'exact', head: true }).eq('is_monitored', true),
  ])

  return (
    <LiveDashboard initialStats={{
      videos:    videos.count    ?? 0,
      clips:     clips.count     ?? 0,
      queue:     queue.count     ?? 0,
      done:      done.count      ?? 0,
      failed:    failed.count    ?? 0,
      today:     (quota.data as any)?.count ?? 0,
      monitored: streamers.count ?? 0,
    }} />
  )
}
