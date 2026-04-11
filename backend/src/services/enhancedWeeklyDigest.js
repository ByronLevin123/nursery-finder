// Enhanced weekly digest — uses notification_preferences table.
// Gathers new nurseries, Ofsted changes, Q&A answers, and review counts
// for users who have email_weekly_digest = true.

import db from '../db.js'
import { logger } from '../logger.js'
import { sendEmail } from './emailService.js'
import { renderEnhancedWeeklyDigestEmail } from './emailTemplates.js'

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
    logger.warn({ err: err?.message, template }, 'enhancedDigest: email_log insert failed')
  }
}

function postcodeDistrict(postcode) {
  if (!postcode) return null
  const clean = postcode.replace(/\s+/g, '').toUpperCase()
  if (clean.length < 4) return clean
  return clean.slice(0, clean.length - 3).trim()
}

export async function sendEnhancedWeeklyDigests() {
  if (!db) {
    logger.warn('enhancedDigest: db not configured')
    return { sent: 0, skipped: 0, errors: 0 }
  }

  // Find users with email_weekly_digest = true in notification_preferences
  const { data: prefs, error: prefsErr } = await db
    .from('notification_preferences')
    .select('user_id')
    .eq('email_weekly_digest', true)

  if (prefsErr) {
    logger.error({ err: prefsErr.message }, 'enhancedDigest: failed to fetch prefs')
    return { sent: 0, skipped: 0, errors: 1 }
  }

  if (!prefs || prefs.length === 0) {
    logger.info('enhancedDigest: no eligible users')
    return { sent: 0, skipped: 0, errors: 0 }
  }

  const userIds = prefs.map((p) => p.user_id)

  // Get profiles for these users
  const { data: profiles, error: profErr } = await db
    .from('user_profiles')
    .select('id, display_name, home_postcode')
    .in('id', userIds)

  if (profErr) {
    logger.error({ err: profErr.message }, 'enhancedDigest: failed to fetch profiles')
    return { sent: 0, skipped: 0, errors: 1 }
  }

  if (!profiles || profiles.length === 0) {
    logger.info('enhancedDigest: no profiles found for opted-in users')
    return { sent: 0, skipped: 0, errors: 0 }
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const since = sevenDaysAgo.toISOString()

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const profile of profiles) {
    try {
      const userId = profile.id
      const district = postcodeDistrict(profile.home_postcode)

      // Get user email
      let email = null
      try {
        const { data: authUser } = await db.auth.admin.getUserById(userId)
        email = authUser?.user?.email || null
      } catch {
        /* no auth lookup */
      }

      if (!email) {
        skipped++
        continue
      }

      // 1. New nurseries near the user's postcode (last 7 days)
      let newNurseries = []
      if (district) {
        const { data: nurseries } = await db
          .from('nurseries')
          .select('urn, name, ofsted_overall_grade, town, postcode')
          .ilike('postcode', `${district}%`)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(5)
        newNurseries = nurseries || []
      }

      // 2. Ofsted changes on shortlisted nurseries
      let ofstedChanges = []
      try {
        // Get user's shortlisted nursery URNs from saved_searches or shortlist
        // We check nursery_reviews and saved_searches for URNs the user cares about
        const { data: shortlistData } = await db
          .from('nursery_reviews')
          .select('urn')
          .eq('user_id', userId)

        const shortlistUrns = (shortlistData || []).map((r) => r.urn).filter(Boolean)

        if (shortlistUrns.length > 0) {
          const { data: changes } = await db
            .from('nurseries')
            .select('urn, name, ofsted_overall_grade, previous_ofsted_grade')
            .in('urn', shortlistUrns)
            .not('previous_ofsted_grade', 'is', null)
            .neq('ofsted_overall_grade', 'previous_ofsted_grade')
            .gte('updated_at', since)
            .limit(5)

          ofstedChanges = (changes || []).map((c) => ({
            urn: c.urn,
            name: c.name,
            previous_grade: c.previous_ofsted_grade,
            new_grade: c.ofsted_overall_grade,
          }))
        }
      } catch (err) {
        logger.warn({ err: err?.message, userId }, 'enhancedDigest: ofsted changes query failed')
      }

      // 3. New answers to the user's questions
      let newAnswers = []
      try {
        const { data: questions } = await db
          .from('nursery_questions')
          .select('id, nursery_urn, question')
          .eq('user_id', userId)

        if (questions && questions.length > 0) {
          const questionIds = questions.map((q) => q.id)
          const questionMap = Object.fromEntries(questions.map((q) => [q.id, q]))

          const { data: answers } = await db
            .from('nursery_answers')
            .select('id, question_id, created_at')
            .in('question_id', questionIds)
            .gte('created_at', since)
            .neq('user_id', userId)
            .limit(5)

          if (answers && answers.length > 0) {
            // Look up nursery names
            const urns = [...new Set(questions.map((q) => q.nursery_urn).filter(Boolean))]
            const { data: nurseryData } = await db
              .from('nurseries')
              .select('urn, name')
              .in('urn', urns)
            const nurseryNameMap = Object.fromEntries(
              (nurseryData || []).map((n) => [n.urn, n.name])
            )

            newAnswers = answers.map((a) => {
              const q = questionMap[a.question_id]
              return {
                urn: q?.nursery_urn,
                nursery_name: nurseryNameMap[q?.nursery_urn] || 'Nursery',
                question: q?.question || '',
              }
            })
          }
        }
      } catch (err) {
        logger.warn({ err: err?.message, userId }, 'enhancedDigest: answers query failed')
      }

      // 4. Count of new reviews on shortlisted nurseries
      let newReviewCount = 0
      try {
        const { data: userReviewUrns } = await db
          .from('nursery_reviews')
          .select('urn')
          .eq('user_id', userId)

        const urns = [...new Set((userReviewUrns || []).map((r) => r.urn).filter(Boolean))]

        if (urns.length > 0) {
          const { count } = await db
            .from('nursery_reviews')
            .select('id', { count: 'exact', head: true })
            .in('urn', urns)
            .neq('user_id', userId)
            .gte('created_at', since)

          newReviewCount = count || 0
        }
      } catch (err) {
        logger.warn({ err: err?.message, userId }, 'enhancedDigest: review count query failed')
      }

      // Skip user if there are no updates at all
      if (
        newNurseries.length === 0 &&
        ofstedChanges.length === 0 &&
        newAnswers.length === 0 &&
        newReviewCount === 0
      ) {
        skipped++
        continue
      }

      const rendered = renderEnhancedWeeklyDigestEmail({
        userName: profile.display_name,
        postcode: profile.home_postcode,
        newNurseries,
        ofstedChanges,
        newAnswers,
        newReviewCount,
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
        template: 'enhanced_weekly_digest',
        subject: rendered.subject,
        resendId: result?.messageId,
      })

      sent++
    } catch (err) {
      logger.error({ err: err?.message, userId: profile.id }, 'enhancedDigest: send failed')
      errors++
    }
  }

  logger.info({ sent, skipped, errors, totalUsers: profiles.length }, 'enhancedDigest: complete')
  return { sent, skipped, errors }
}

export default { sendEnhancedWeeklyDigests }
