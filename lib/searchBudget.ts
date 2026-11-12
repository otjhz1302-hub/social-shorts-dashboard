// YouTube search budget shared by the bot and dashboard users.
// Mirrors core/search_budget.py: a Pacific-day counter per actor ('bot' or a user id).

export const COST_PER_REQUEST = 2   // one "Buscar lives ahora" = 2 YouTube searches
export const DEFAULT_LIMITS = { daily_total: 90, bot_daily: 60, guest_daily: 4 }

export const ptDay = () => new Date(Date.now() - 8 * 3_600_000).toISOString().slice(0, 10)

export type Limits = typeof DEFAULT_LIMITS

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function budgetSnapshot(admin: any, userId: string) {
  const [lim, usage, prof, pending] = await Promise.all([
    admin.from('search_limits').select('daily_total,bot_daily,guest_daily').eq('id', 1).maybeSingle(),
    admin.from('search_usage').select('actor,searches').eq('day', ptDay()),
    admin.from('profiles').select('role,search_daily_limit').eq('id', userId).maybeSingle(),
    admin.from('search_requests').select('user_id').in('status', ['pending', 'running']),
  ])
  const limits: Limits = { ...DEFAULT_LIMITS, ...(lim.data ?? {}) }
  const used: Record<string, number> = {}
  for (const r of (usage.data ?? []) as { actor: string; searches: number }[]) used[r.actor] = r.searches
  const pendingBy: Record<string, number> = {}
  for (const r of (pending.data ?? []) as { user_id: string }[]) pendingBy[r.user_id] = (pendingBy[r.user_id] ?? 0) + COST_PER_REQUEST

  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
  const total = sum(used) + sum(pendingBy)
  const isAdmin = prof.data?.role === 'admin'
  const cap: number = isAdmin ? limits.daily_total : (prof.data?.search_daily_limit ?? limits.guest_daily)
  const mine = (used[userId] ?? 0) + (pendingBy[userId] ?? 0)
  return {
    limits, used, total, cap, mine, isAdmin,
    hasPending: !!pendingBy[userId],
    remaining: Math.max(0, Math.min(cap - mine, limits.daily_total - total)),
    tablesMissing: !!(lim.error || usage.error),
  }
}
