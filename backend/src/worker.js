import 'dotenv/config'
import cron from 'node-cron'
import { execFile } from 'child_process'
import { ingestOfstedRegister } from './services/ofstedIngest.js'
import { geocodeNurseriesBatch } from './services/geocoding.js'
import { geocodeSchoolsBatch } from './services/schoolIngest.js'
import { ingestLandRegistryYear, refreshPropertyStats } from './services/landRegistry.js'
import { runDailyDigest } from './services/digestJob.js'
import { recomputeAllDimensionScores, computeProviderResponsiveness } from './services/scoringEngine.js'
import { notifyVisitReminder } from './services/notificationService.js'
import { processDripQueue } from './services/dripEngine.js'
import { sendWeeklyDigests } from './services/weeklyDigest.js'
import { sendEnhancedWeeklyDigests } from './services/enhancedWeeklyDigest.js'
import { sendReengagementEmails } from './services/reengagement.js'
import { processSavedSearchAlerts } from './services/savedSearchAlerts.js'
import { processOfstedChangeNotifications } from './services/ofstedChangeNotifier.js'
import { syncGooglePlacesData, refreshStaleGoogleData } from './services/googlePlaces.js'
import { computeAllDataCompleteness } from './services/dataCompleteness.js'
import { refreshCrimeForDistricts } from './services/policeApi.js'
import { callClaude, isClaudeAvailable } from './services/claudeApi.js'
import { isAvailable as isBufferAvailable, getProfiles, createPost } from './services/bufferService.js'
import { sendEmail, isEmailAvailable } from './services/emailService.js'
import { renderProviderInviteEmail } from './services/emailTemplates.js'
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

  // Also geocode schools that have postcodes but no lat/lng
  try {
    const schoolResult = await geocodeSchoolsBatch(200)
    logger.info(schoolResult, 'cron: school geocoding complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: school geocoding failed')
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
  try {
    const result = await refreshCrimeForDistricts({ limit: 100, staleDays: 30 })
    logger.info(result, 'cron: crime data refresh complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: crime data refresh failed')
  }
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

// Nightly: compute provider responsiveness metrics (4:40am, after dimension scores)
cron.schedule('40 4 * * *', async () => {
  logger.info('cron: computing provider responsiveness')
  try {
    const result = await computeProviderResponsiveness()
    logger.info(result, 'cron: provider responsiveness complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: provider responsiveness failed')
  }
})

// Nightly: compute data completeness percentages (4:45am, after dimension scores)
cron.schedule('45 4 * * *', async () => {
  logger.info('cron: computing data completeness')
  try {
    const result = await computeAllDataCompleteness()
    logger.info(result, 'cron: data completeness complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: data completeness failed')
  }
})

// Nightly: recalculate family scores
cron.schedule('0 5 * * *', async () => {
  logger.info('cron: recalculating family scores')
  try {
    const { data, error } = await db.rpc('calculate_all_family_scores')
    if (error) throw error
    logger.info({ districts: data }, 'cron: family scores complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: family scores failed')
  }
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

// Every 15 minutes: process drip email queue
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
cron.schedule('0 9 * * *', async () => {
  logger.info('cron: starting saved-search alerts')
  try {
    const result = await processSavedSearchAlerts()
    logger.info(result, 'cron: saved-search alerts complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: saved-search alerts failed')
  }
})

// Monday 8am: weekly digest (legacy — user_profiles.email_weekly_digest)
cron.schedule('0 8 * * 1', async () => {
  logger.info('cron: starting weekly digest')
  try {
    const result = await sendWeeklyDigests()
    logger.info(result, 'cron: weekly digest complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: weekly digest failed')
  }
})

// Monday 8am: enhanced weekly digest (notification_preferences.email_weekly_digest)
cron.schedule('0 8 * * 1', async () => {
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

// ==========================================================================
// MARKETING AUTOMATION CRONS
// ==========================================================================

// Daily 10am: auto-send provider outreach emails (50 unclaimed nurseries/day)
cron.schedule('0 10 * * *', async () => {
  if (!db || !isEmailAvailable()) return
  logger.info('cron: starting provider outreach batch')
  try {
    const { data: unclaimed } = await db
      .from('nurseries')
      .select('urn, name, town, local_authority, email')
      .eq('registration_status', 'Active')
      .is('claimed_by_user_id', null)
      .not('email', 'is', null)
      .limit(50)

    if (!unclaimed?.length) {
      logger.info('cron: no unclaimed nurseries with emails to contact')
      return
    }

    // Check which have already been invited
    const urns = unclaimed.map((n) => n.urn)
    const { data: existing } = await db
      .from('provider_invites')
      .select('urn')
      .in('urn', urns)
    const alreadySent = new Set((existing || []).map((e) => e.urn))

    let sent = 0
    for (const nursery of unclaimed) {
      if (alreadySent.has(nursery.urn)) continue
      try {
        const email = renderProviderInviteEmail({
          nurseryName: nursery.name,
          town: nursery.town,
          urn: nursery.urn,
        })
        await sendEmail({ to: nursery.email, ...email })
        await db.from('provider_invites').insert({
          urn: nursery.urn,
          email: nursery.email,
          status: 'sent',
          campaign_type: 'invite',
          sent_at: new Date().toISOString(),
        })
        sent++
      } catch (err) {
        logger.warn({ urn: nursery.urn, err: err?.message }, 'provider outreach: send failed')
      }
    }
    logger.info({ sent, total: unclaimed.length }, 'cron: provider outreach complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: provider outreach failed')
  }
})

// Tue/Thu/Sat 9am: auto-generate + post to Buffer
cron.schedule('0 9 * * 2,4,6', async () => {
  if (!isClaudeAvailable() || !isBufferAvailable()) {
    logger.info('cron: auto-social skipped — Claude or Buffer not configured')
    return
  }
  logger.info('cron: starting auto social post')
  try {
    const topics = [
      'Tips for choosing the right nursery for your child',
      'Understanding UK funded childcare hours — what parents need to know',
      'How to check an Ofsted rating before choosing a nursery',
      'Moving to a new area? How to find family-friendly neighbourhoods',
      'Nursery vs childminder — how to decide what is best for your family',
      'What to look for on a nursery visit — a parent checklist',
      'How NurseryMatch helps parents compare nurseries for free',
      'The true cost of nursery care in the UK and how to save',
      'Why checking nearby schools matters when choosing a nursery',
      'Signs of a great nursery — what Ofsted Outstanding really means',
    ]
    const topic = topics[Math.floor(Math.random() * topics.length)]

    const content = await callClaude({
      prompt: `Write a short, engaging social media post (max 250 characters) about: ${topic}. Include a call-to-action pointing to nurserymatch.com. Use a friendly, helpful tone. Do not use emojis. Return only the post text, nothing else.`,
      system: 'You write social media posts for NurseryMatch, a free UK nursery comparison website.',
      maxTokens: 200,
    })

    if (!content?.trim()) {
      logger.warn('cron: auto-social — empty Claude response')
      return
    }

    const { data: profiles } = await getProfiles()
    if (!profiles?.length) {
      logger.warn('cron: auto-social — no Buffer profiles connected')
      return
    }

    const profileIds = profiles.map((p) => p.id)
    const { data: post, error } = await createPost({ text: content.trim(), profileIds })

    if (error) {
      logger.error({ error }, 'cron: auto-social Buffer post failed')
    } else {
      logger.info({ postId: post?.id, profiles: profileIds.length }, 'cron: auto-social posted')
      // Save to DB for tracking
      if (db) {
        for (const p of profiles) {
          await db.from('marketing_posts').insert({
            content: content.trim(),
            platform: p.service || 'unknown',
            status: 'posted',
            buffer_post_id: post?.id || null,
            posted_at: new Date().toISOString(),
          }).catch(() => {})
        }
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'cron: auto-social failed')
  }
})

// Weekly Monday 7am: auto-generate SEO blog post
cron.schedule('0 7 * * 1', async () => {
  if (!isClaudeAvailable() || !db) {
    logger.info('cron: auto-blog skipped — Claude or DB not configured')
    return
  }
  logger.info('cron: starting auto blog generation')
  try {
    const cities = [
      'London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow',
      'Liverpool', 'Bristol', 'Sheffield', 'Edinburgh', 'Cardiff',
      'Nottingham', 'Newcastle', 'Leicester', 'Southampton', 'Brighton',
    ]
    const city = cities[Math.floor(Math.random() * cities.length)]
    const year = new Date().getFullYear()

    const content = await callClaude({
      prompt: `Write a 1200-word SEO blog post titled "Best Nurseries in ${city} ${year} — A Parent's Guide". Include: introduction about choosing a nursery in ${city}, what to look for (Ofsted ratings, funded places, location), tips for visiting, and a call-to-action to search on nurserymatch.com. Write in British English. Format with markdown headings (##). Be informative and practical.`,
      system: 'You write SEO-optimised blog content for NurseryMatch, a free UK nursery comparison website at nurserymatch.com.',
      maxTokens: 2000,
      model: 'claude-sonnet-4-6',
    })

    if (!content?.trim()) {
      logger.warn('cron: auto-blog — empty Claude response')
      return
    }

    await db.from('marketing_content').insert({
      type: 'blog',
      prompt_used: `Best Nurseries in ${city} ${year}`,
      content: content.trim(),
      status: 'draft',
    })

    logger.info({ city }, 'cron: auto-blog draft created — review in Admin > Marketing')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: auto-blog failed')
  }
})
