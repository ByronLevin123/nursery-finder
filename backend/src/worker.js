import 'dotenv/config'
import cron from 'node-cron'
import { execFile } from 'child_process'
import { ingestOfstedRegister } from './services/ofstedIngest.js'
import { geocodeNurseriesBatch } from './services/geocoding.js'
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
import db from './db.js'
import { logger } from './logger.js'

logger.info('NurseryMatch worker started')

// Geocode 500 nurseries every night at 3am
cron.schedule('0 3 * * *', async () => {
  logger.info('cron: starting nightly geocoding batch')
  try {
    const result = await geocodeNurseriesBatch(500)
    logger.info(result, 'cron: geocoding complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: geocoding failed')
  }
})

// Enrich nurseries with Google Places data nightly at 4am (100 per night ≈ 3k/month)
cron.schedule('0 4 * * *', async () => {
  logger.info('cron: starting Google Places enrichment')
  try {
    const result = await syncGooglePlacesData(100, { photosEnabled: true })
    logger.info(result, 'cron: Google Places enrichment complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: Google Places enrichment failed')
  }
})

// Refresh stale Google ratings weekly on Sundays at 5am
cron.schedule('0 5 * * 0', async () => {
  logger.info('cron: starting Google Places stale refresh')
  try {
    const result = await refreshStaleGoogleData(200, 90)
    logger.info(result, 'cron: Google Places refresh complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: Google Places refresh failed')
  }
})

// Re-sync Ofsted data on 1st of every month at 2am
cron.schedule('0 2 1 * *', async () => {
  logger.info('cron: starting monthly Ofsted sync')
  try {
    const result = await ingestOfstedRegister()
    logger.info(result, 'cron: Ofsted sync complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: Ofsted sync failed')
  }
})

// Ofsted grade change notifications — 2nd of each month at 3am (after re-sync at 2am on the 1st)
cron.schedule('0 3 2 * *', async () => {
  logger.info('cron: starting Ofsted change notifications')
  try {
    const result = await processOfstedChangeNotifications()
    logger.info(result, 'cron: Ofsted change notifications complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: Ofsted change notifications failed')
  }
})

// Monthly: refresh Land Registry data (1st of month, 1am)
cron.schedule('0 1 1 * *', async () => {
  logger.info('cron: refreshing Land Registry data')
  try {
    const currentYear = new Date().getFullYear()
    await ingestLandRegistryYear(currentYear)
    await refreshPropertyStats()
  } catch (err) {
    logger.error({ err: err.message }, 'cron: Land Registry refresh failed')
  }
})

// Nightly: crime data batch (takes ~1 hour for 100 districts)
cron.schedule('0 1 * * *', async () => {
  logger.info('cron: refreshing crime data batch')
})

// Nightly: recompute nursery dimension scores (4:30am)
cron.schedule('30 4 * * *', async () => {
  logger.info('cron: recomputing dimension scores')
  try {
    const result = await recomputeAllDimensionScores()
    logger.info(result, 'cron: dimension scores complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: dimension scores failed')
  }
})

// Nightly: recalculate family scores
cron.schedule('0 5 * * *', async () => {
  logger.info('cron: recalculating family scores')
})

// Daily: saved-search digest (8am UTC)
cron.schedule('0 8 * * *', async () => {
  logger.info('cron: starting daily digest')
  try {
    const result = await runDailyDigest()
    logger.info(result, 'cron: daily digest complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: daily digest failed')
  }
})

// Daily: visit reminders at 8am — notify parents about visits tomorrow
cron.schedule('0 8 * * *', async () => {
  logger.info('cron: starting visit reminders')
  try {
    if (!db) {
      logger.warn('cron: visit reminders skipped — db not configured')
      return
    }

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

    logger.info({ total: valid.length, sent }, 'cron: visit reminders complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: visit reminders failed')
  }
})

// Hourly: process drip email queue
cron.schedule('0 * * * *', async () => {
  logger.info('cron: processing drip queue')
  try {
    const result = await processDripQueue()
    logger.info(result, 'cron: drip queue complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: drip queue failed')
  }
})

// Daily 8:30am: saved-search new-nursery alerts
cron.schedule('30 8 * * *', async () => {
  logger.info('cron: starting saved-search alerts')
  try {
    const result = await processSavedSearchAlerts()
    logger.info(result, 'cron: saved-search alerts complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: saved-search alerts failed')
  }
})

// Monday 9am: weekly digest (legacy — user_profiles.email_weekly_digest)
cron.schedule('0 9 * * 1', async () => {
  logger.info('cron: starting weekly digest')
  try {
    const result = await sendWeeklyDigests()
    logger.info(result, 'cron: weekly digest complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: weekly digest failed')
  }
})

// Monday 9am: enhanced weekly digest (notification_preferences.email_weekly_digest)
cron.schedule('0 9 * * 1', async () => {
  logger.info('cron: starting enhanced weekly digest')
  try {
    const result = await sendEnhancedWeeklyDigests()
    logger.info(result, 'cron: enhanced weekly digest complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: enhanced weekly digest failed')
  }
})

// Wednesday 10am: re-engagement emails
cron.schedule('0 10 * * 3', async () => {
  logger.info('cron: starting re-engagement emails')
  try {
    const result = await sendReengagementEmails()
    logger.info(result, 'cron: re-engagement complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: re-engagement failed')
  }
})

// NOTE: the public sitemap is generated by Next.js statically at build time
// (frontend/app/sitemap.ts), so Vercel rebuilds it on every push — no cron is
// strictly required. The legacy script-based regeneration is kept below for
// any backend-hosted sitemap.

// Self-ping every 10 minutes to keep Render free-tier warm (avoids 30s cold-start)
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

// Weekly: regenerate sitemap (Sundays at 4am)
cron.schedule('0 4 * * 0', async () => {
  logger.info('cron: regenerating sitemap')
  execFile('node', ['../../scripts/generate-sitemap.js'], (err, stdout) => {
    if (err) logger.error({ err: err.message }, 'cron: sitemap generation failed')
    else logger.info(stdout, 'cron: sitemap generated')
  })
})

// Daily 6am: snapshot admin reports cache
cron.schedule('0 6 * * *', async () => {
  logger.info('cron: snapshotting admin reports cache')
  try {
    if (!db) return

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
    logger.info({ date: today }, 'cron: admin reports cache snapshotted')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: admin reports cache failed')
  }
})
