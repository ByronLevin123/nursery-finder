import 'dotenv/config'
import cron from 'node-cron'
import { exec } from 'child_process'
import { ingestOfstedRegister } from './services/ofstedIngest.js'
import { geocodeNurseriesBatch } from './services/geocoding.js'
import { ingestLandRegistryYear, refreshPropertyStats } from './services/landRegistry.js'
import { runDailyDigest } from './services/digestJob.js'
import { recomputeAllDimensionScores } from './services/scoringEngine.js'
import { notifyVisitReminder } from './services/notificationService.js'
import { processDripQueue } from './services/dripEngine.js'
import { sendWeeklyDigests } from './services/weeklyDigest.js'
import { sendReengagementEmails } from './services/reengagement.js'
import db from './db.js'
import { logger } from './logger.js'

logger.info('CompareTheNursery worker started')

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

// Monday 9am: weekly digest
cron.schedule('0 9 * * 1', async () => {
  logger.info('cron: starting weekly digest')
  try {
    const result = await sendWeeklyDigests()
    logger.info(result, 'cron: weekly digest complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: weekly digest failed')
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
  exec('node ../../scripts/generate-sitemap.js', (err, stdout) => {
    if (err) logger.error({ err: err.message }, 'cron: sitemap generation failed')
    else logger.info(stdout, 'cron: sitemap generated')
  })
})
