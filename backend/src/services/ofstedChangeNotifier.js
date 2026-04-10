// Ofsted rating change notifier — emails affected users when a nursery's
// Ofsted grade changes during a re-sync. Runs via cron after the monthly
// Ofsted ingest.

import db from '../db.js'
import { logger } from '../logger.js'
import { isEmailAvailable, sendEmail } from './emailService.js'
import { renderOfstedChangeEmail } from './emailTemplates.js'

const BATCH_SIZE = 50

// ---------- helpers ----------

async function logEmail({ userId, emailTo, template, subject, resendId }) {
  if (!db) return
  try {
    await db.from('email_log').insert({
      user_id: userId,
      email_to: emailTo,
      template,
      subject,
      status: 'sent',
      resend_id: resendId || null,
    })
  } catch (err) {
    logger.warn({ err: err?.message, template }, 'ofstedChangeNotifier: email_log insert failed')
  }
}

async function getUserEmail(userId) {
  if (!db) return null
  try {
    const { data } = await db.auth.admin.getUserById(userId)
    return data?.user?.email || null
  } catch {
    return null
  }
}

// ---------- public API ----------

export async function processOfstedChangeNotifications() {
  if (!db) {
    logger.warn('ofstedChangeNotifier: db not configured')
    return { sent: 0, skipped: 0, errors: 0, changes: 0 }
  }

  if (!isEmailAvailable()) {
    logger.warn('ofstedChangeNotifier: email not configured (no RESEND_API_KEY)')
    return { sent: 0, skipped: 0, errors: 0, changes: 0 }
  }

  // 1. Fetch unnotified changes
  const { data: changes, error: changeErr } = await db
    .from('ofsted_changes')
    .select('*')
    .eq('notified', false)
    .order('change_date', { ascending: true })
    .limit(500)

  if (changeErr) {
    logger.error({ err: changeErr.message }, 'ofstedChangeNotifier: failed to fetch changes')
    return { sent: 0, skipped: 0, errors: 1, changes: 0 }
  }

  if (!changes || changes.length === 0) {
    logger.info('ofstedChangeNotifier: no unnotified changes')
    return { sent: 0, skipped: 0, errors: 0, changes: 0 }
  }

  logger.info({ count: changes.length }, 'ofstedChangeNotifier: processing changes')

  let sent = 0
  let skipped = 0
  let errors = 0

  // 2. For each change, look up the nursery and find affected users
  for (const change of changes) {
    try {
      // Fetch nursery details
      const { data: nursery } = await db
        .from('nurseries')
        .select('urn, name, town, postcode')
        .eq('urn', change.nursery_urn)
        .maybeSingle()

      if (!nursery) {
        logger.warn({ urn: change.nursery_urn }, 'ofstedChangeNotifier: nursery not found, skipping')
        skipped++
        await markNotified(change.id)
        continue
      }

      const postcodeDistrict = nursery.postcode
        ? nursery.postcode.split(' ')[0]
        : null

      // Track users we have already emailed for this change to avoid duplicates
      const notifiedUserIds = new Set()

      // 2a. Notify providers who have claimed this nursery
      const { data: claims } = await db
        .from('nursery_claims')
        .select('user_id, claimer_email, claimer_name')
        .eq('urn', change.nursery_urn)
        .eq('status', 'approved')

      if (claims && claims.length > 0) {
        for (const claim of claims) {
          try {
            const email = claim.claimer_email || (claim.user_id ? await getUserEmail(claim.user_id) : null)
            if (!email) {
              skipped++
              continue
            }

            const rendered = renderOfstedChangeEmail({
              nurseryName: nursery.name,
              town: nursery.town,
              urn: nursery.urn,
              previousGrade: change.previous_grade,
              newGrade: change.new_grade,
              userName: claim.claimer_name,
            })

            const result = await sendEmail({
              to: email,
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
            })

            await logEmail({
              userId: claim.user_id,
              emailTo: email,
              template: 'ofsted_change_provider',
              subject: rendered.subject,
              resendId: result?.messageId,
            })

            if (claim.user_id) notifiedUserIds.add(claim.user_id)
            sent++
          } catch (claimErr) {
            logger.warn(
              { err: claimErr?.message, urn: change.nursery_urn },
              'ofstedChangeNotifier: provider notification failed'
            )
            errors++
          }
        }
      }

      // 2b. Notify users with saved searches matching this nursery's postcode district
      if (postcodeDistrict) {
        const { data: searches } = await db
          .from('saved_searches')
          .select('id, user_id, postcode, name')
          .eq('alert_on_new', true)
          .ilike('postcode', `${postcodeDistrict}%`)

        if (searches && searches.length > 0) {
          // Group by user to send one email per user
          const userSearches = new Map()
          for (const s of searches) {
            if (notifiedUserIds.has(s.user_id)) continue
            if (!userSearches.has(s.user_id)) userSearches.set(s.user_id, s)
          }

          for (const [userId, search] of userSearches) {
            try {
              // Check email preferences
              const { data: profile } = await db
                .from('user_profiles')
                .select('display_name, email_new_nurseries')
                .eq('id', userId)
                .maybeSingle()

              if (profile && profile.email_new_nurseries === false) {
                skipped++
                continue
              }

              const email = await getUserEmail(userId)
              if (!email) {
                skipped++
                continue
              }

              const rendered = renderOfstedChangeEmail({
                nurseryName: nursery.name,
                town: nursery.town,
                urn: nursery.urn,
                previousGrade: change.previous_grade,
                newGrade: change.new_grade,
                userName: profile?.display_name,
              })

              const result = await sendEmail({
                to: email,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
              })

              await logEmail({
                userId,
                emailTo: email,
                template: 'ofsted_change_saved_search',
                subject: rendered.subject,
                resendId: result?.messageId,
              })

              notifiedUserIds.add(userId)
              sent++
            } catch (searchErr) {
              logger.warn(
                { err: searchErr?.message, userId },
                'ofstedChangeNotifier: saved search user notification failed'
              )
              errors++
            }
          }
        }
      }

      // 3. Mark change as notified
      await markNotified(change.id)
    } catch (err) {
      logger.error(
        { err: err?.message, changeId: change.id },
        'ofstedChangeNotifier: change processing failed'
      )
      errors++
    }
  }

  logger.info(
    { sent, skipped, errors, changes: changes.length },
    'ofstedChangeNotifier: complete'
  )
  return { sent, skipped, errors, changes: changes.length }
}

async function markNotified(changeId) {
  try {
    await db
      .from('ofsted_changes')
      .update({ notified: true })
      .eq('id', changeId)
  } catch (err) {
    logger.warn({ err: err?.message, changeId }, 'ofstedChangeNotifier: failed to mark notified')
  }
}

export default { processOfstedChangeNotifications }
