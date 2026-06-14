import db from '../db.js'
import { logger } from '../logger.js'

export async function captureReportSnapshot() {
  if (!db) throw new Error('Database not configured')

  const [users, newUsers, providers, nurseries, claimed, activeSubs, enquiries, newEnquiries] =
    await Promise.all([
      db.from('user_profiles').select('id', { count: 'exact', head: true }),
      db
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      db.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'provider'),
      db.from('nurseries').select('id', { count: 'exact', head: true }),
      db
        .from('nurseries')
        .select('id', { count: 'exact', head: true })
        .not('claimed_by_user_id', 'is', null),
      db
        .from('provider_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .neq('tier', 'free'),
      db.from('enquiries').select('id', { count: 'exact', head: true }),
      db
        .from('enquiries')
        .select('id', { count: 'exact', head: true })
        .gte('sent_at', new Date(Date.now() - 86400000).toISOString()),
    ])

  const proCount =
    (
      await db
        .from('provider_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'pro')
        .eq('status', 'active')
    ).count ?? 0
  const premiumCount =
    (
      await db
        .from('provider_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'premium')
        .eq('status', 'active')
    ).count ?? 0
  const mrr = proCount * 29 + premiumCount * 79

  const today = new Date().toISOString().split('T')[0]
  const { error } = await db.from('admin_reports_cache').upsert(
    {
      report_date: today,
      total_users: users.count ?? 0,
      new_users: newUsers.count ?? 0,
      total_providers: providers.count ?? 0,
      total_nurseries: nurseries.count ?? 0,
      claimed_nurseries: claimed.count ?? 0,
      active_subscriptions: activeSubs.count ?? 0,
      mrr_gbp: mrr,
      total_enquiries: enquiries.count ?? 0,
      new_enquiries: newEnquiries.count ?? 0,
    },
    { onConflict: 'report_date' }
  )

  if (error) throw error
  logger.info({ date: today }, 'admin reports snapshot taken')
  return { date: today, total_users: users.count ?? 0 }
}
