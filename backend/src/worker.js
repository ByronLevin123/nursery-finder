import 'dotenv/config'
import cron from 'node-cron'
import { ingestOfstedRegister } from './services/ofstedIngest.js'
import { geocodeNurseriesBatch } from './services/geocoding.js'
import { geocodeSchoolsBatch } from './services/schoolIngest.js'
import { ingestLandRegistryYear, refreshPropertyStats } from './services/landRegistry.js'
import { runDailyDigest } from './services/digestJob.js'
import { recomputeAllDimensionScores } from './services/scoringEngine.js'
import { notifyVisitReminder } from './services/notificationService.js'
import { processDripQueue } from './services/dripEngine.js'
import { sendWeeklyDigests } from './services/weeklyDigest.js'
import { sendEnhancedWeeklyDigests } from './services/enhancedWeeklyDigest.js'
import { sendReengagementEmails } from './services/reengagement.js'
import { processSavedSearchAlerts } from './services/savedSearchAlerts.js'
import { processOfstedChangeNotifications } from './services/ofstedChangeNotifier.js'
import { syncGooglePlacesData, refreshStaleGoogleData } from './services/googlePlaces.js'
import { refreshCrimeForDistricts } from './services/policeApi.js'
import { runTrackedJob } from './services/jobRunner.js'
import { pruneJobRuns } from './services/jobTracker.js'
import db from './db.js'
import { logger } from './logger.js'

logger.info('NurseryMatch worker started')

// Every scheduled job below is wrapped in runTrackedJob so it records a row in
// job_runs (visible in the admin Jobs panel) and never crashes the worker on
// failure. The two sub-hourly utility crons (drip queue, self-ping) are left
// untracked on purpose — tracking them would add ~240 job_runs rows/day.

// Geocode nurseries (and schools) every night at 3am
cron.schedule('0 3 * * *', () =>
  runTrackedJob('geocoding', async () => {
    const nurseries = await geocodeNurseriesBatch(500)
    // School geocoding failure must not fail the nightly nursery geocode.
    let schools
    try {
      schools = await geocodeSchoolsBatch(200)
    } catch (err) {
      logger.error({ err: err.message }, 'cron: school geocoding failed')
      schools = { error: err.message }
    }
    return { nurseries, schools }
  })
)

// Enrich nurseries with Google Places data nightly at 4am (100 per night ≈ 3k/month)
cron.schedule('0 4 * * *', () =>
  runTrackedJob('google_places_enrichment', () =>
    syncGooglePlacesData(100, { photosEnabled: true })
  )
)

// Refresh stale Google ratings weekly on Sundays at 5am
cron.schedule('0 5 * * 0', () =>
  runTrackedJob('google_places_refresh', () => refreshStaleGoogleData(200, 90))
)

// Re-sync Ofsted data on 1st of every month at 2am
cron.schedule('0 2 1 * *', () => runTrackedJob('ofsted_sync', () => ingestOfstedRegister()))

// Ofsted grade change notifications — 2nd of each month at 3am (after re-sync at 2am on the 1st)
cron.schedule('0 3 2 * *', () =>
  runTrackedJob('ofsted_change_notifications', () => processOfstedChangeNotifications())
)

// Monthly: refresh Land Registry data (1st of month, 1am)
cron.schedule('0 1 1 * *', () =>
  runTrackedJob('land_registry_refresh', async () => {
    const currentYear = new Date().getFullYear()
    await ingestLandRegistryYear(currentYear)
    await refreshPropertyStats()
    return { year: currentYear }
  })
)

// Nightly 1am: refresh crime stats for the stalest districts.
// Rate-limited (~600ms/request, 3 months each), so we keep the batch modest.
cron.schedule('0 1 * * *', () =>
  runTrackedJob('crime_refresh', () => refreshCrimeForDistricts({ limit: 50, staleDays: 30 }))
)

// Nightly 3:30am: refresh per-district nursery counts (after geocoding at 3am)
cron.schedule('30 3 * * *', () =>
  runTrackedJob('aggregate_areas', async () => {
    if (!db) return { skipped: 'db not configured' }
    const { data, error } = await db.rpc('refresh_postcode_area_nursery_stats')
    if (error) throw error
    return { districts_updated: data }
  })
)

// Nightly: recompute nursery dimension scores (4:30am)
cron.schedule('30 4 * * *', () =>
  runTrackedJob('dimension_scores', () => recomputeAllDimensionScores())
)

// Nightly: recalculate family scores (5am)
cron.schedule('0 5 * * *', () =>
  runTrackedJob('family_scores', async () => {
    if (!db) return { skipped: 'db not configured' }
    const { data, error } = await db.rpc('calculate_all_family_scores')
    if (error) throw error
    return { districts: data }
  })
)

// Daily: saved-search digest (8am UTC)
cron.schedule('0 8 * * *', () => runTrackedJob('daily_digest', () => runDailyDigest()))

// Daily: visit reminders at 8am — notify parents about visits tomorrow
cron.schedule('0 8 * * *', () =>
  runTrackedJob('visit_reminders', async () => {
    if (!db) return { skipped: 'db not configured' }

    // Find confirmed bookings where slot_date = tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    const { data: bookings, error } = await db
      .from('visit_bookings')
      .select('id, user_id, nursery_id, visit_slots(slot_date, slot_time), nurseries(name)')
      .eq('status', 'confirmed')
      .eq('visit_slots.slot_date', tomorrowStr)

    if (error) throw error

    const valid = (bookings || []).filter((b) => b.visit_slots?.slot_date === tomorrowStr)
    let sent = 0

    for (const booking of valid) {
      try {
        // Look up user email for the reminder
        const { data: authUser } = await db.auth.admin
          .getUserById(booking.user_id)
          .catch(() => ({ data: null }))
        await notifyVisitReminder({
          user_id: booking.user_id,
          user_email: authUser?.user?.email || null,
          nursery_name: booking.nurseries?.name || 'your nursery',
          slot_date: booking.visit_slots?.slot_date,
          slot_time: booking.visit_slots?.slot_time,
        })
        sent++
      } catch (err) {
        logger.warn(
          { err: err?.message, bookingId: booking.id },
          'visit reminder failed for booking'
        )
      }
    }

    return { total: valid.length, sent }
  })
)

// Every 15 minutes: process drip email queue (untracked — high frequency)
cron.schedule('*/15 * * * *', async () => {
  logger.info('cron: processing drip queue')
  try {
    const result = await processDripQueue()
    logger.info(result, 'cron: drip queue complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: drip queue failed')
  }
})

// Daily 9am: saved-search new-nursery alerts
cron.schedule('0 9 * * *', () =>
  runTrackedJob('saved_search_alerts', () => processSavedSearchAlerts())
)

// Monday 8am: weekly digest (legacy — user_profiles.email_weekly_digest)
cron.schedule('0 8 * * 1', () => runTrackedJob('weekly_digest', () => sendWeeklyDigests()))

// Monday 8am: enhanced weekly digest (notification_preferences.email_weekly_digest)
cron.schedule('0 8 * * 1', () =>
  runTrackedJob('enhanced_weekly_digest', () => sendEnhancedWeeklyDigests())
)

// Wednesday 10am: re-engagement emails
cron.schedule('0 10 * * 3', () =>
  runTrackedJob('reengagement_emails', () => sendReengagementEmails())
)

// NOTE: the public sitemap is generated by Next.js statically at build time
// (frontend/app/sitemap.ts), so Vercel rebuilds it on every push. There is no
// backend sitemap cron — it was removed as redundant (and its relative path
// broke under Render's working directory).

// Self-ping every 10 minutes to keep Render free-tier warm (untracked — high frequency)
if (process.env.SELF_PING_URL) {
  cron.schedule('*/10 * * * *', async () => {
    try {
      const res = await fetch(process.env.SELF_PING_URL)
      logger.info({ status: res.status }, 'cron: self-ping')
    } catch (err) {
      logger.warn({ err: err.message }, 'cron: self-ping failed')
    }
  })
}

// Daily 2:15am: prune job_runs older than 30 days (keeps the table bounded)
cron.schedule('15 2 * * *', () =>
  runTrackedJob('job_runs_prune', () => pruneJobRuns({ keepDays: 30 }))
)

// Daily 6am: snapshot admin reports cache
cron.schedule('0 6 * * *', () =>
  runTrackedJob('admin_reports_cache', async () => {
    if (!db) return { skipped: 'db not configured' }

    const [users, newUsers, providers, nurseries, claimed, activeSubs, enquiries, newEnquiries] =
      await Promise.all([
        db.from('user_profiles').select('id', { count: 'exact', head: true }),
        db
          .from('user_profiles')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
        db
          .from('user_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'provider'),
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
    return { date: today, mrr_gbp: mrr }
  })
)
