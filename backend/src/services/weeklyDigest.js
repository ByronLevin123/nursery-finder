// Weekly digest — sends "new nurseries near you" emails to opted-in users.

import db from '../db.js'
import { logger } from '../logger.js'
import { sendEmail } from './emailService.js'
import { renderWeeklyDigestEmail } from './emailTemplates.js'

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
    logger.warn({ err: err?.message, template }, 'weeklyDigest: email_log insert failed')
  }
}

function postcodeDistrict(postcode) {
  if (!postcode) return null
  // UK postcode district = everything before the space (or last 3 chars)
  const clean = postcode.replace(/\s+/g, '').toUpperCase()
  if (clean.length < 4) return clean
  return clean.slice(0, clean.length - 3).trim()
}

export async function sendWeeklyDigests() {
  if (!db) {
    logger.warn('weeklyDigest: db not configured')
    return { sent: 0, skipped: 0, errors: 0 }
  }

  // Find all users who want the weekly digest and have a home postcode
  const { data: users, error: usersErr } = await db
    .from('user_profiles')
    .select('id, display_name, home_postcode, email_weekly_digest')
    .eq('email_weekly_digest', true)
    .not('home_postcode', 'is', null)

  if (usersErr) {
    logger.error({ err: usersErr.message }, 'weeklyDigest: failed to fetch users')
    return { sent: 0, skipped: 0, errors: 1 }
  }

  if (!users || users.length === 0) {
    logger.info('weeklyDigest: no eligible users')
    return { sent: 0, skipped: 0, errors: 0 }
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const since = sevenDaysAgo.toISOString()

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const user of users) {
    try {
      const district = postcodeDistrict(user.home_postcode)
      if (!district) {
        skipped++
        continue
      }

      // Find nurseries added or updated in the user's postcode district in the last 7 days
      const { data: nurseries, error: nursErr } = await db
        .from('nurseries')
        .select('urn, name, ofsted_overall_grade, town, postcode')
        .ilike('postcode', `${district}%`)
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(10)

      if (nursErr) {
        logger.warn({ err: nursErr.message, userId: user.id }, 'weeklyDigest: nursery query failed')
        errors++
        continue
      }

      if (!nurseries || nurseries.length === 0) {
        skipped++
        continue
      }

      // Get user email from auth
      let email = null
      try {
        const { data: authUser } = await db.auth.admin.getUserById(user.id)
        email = authUser?.user?.email || null
      } catch {
        /* no auth lookup */
      }

      if (!email) {
        skipped++
        continue
      }

      const rendered = renderWeeklyDigestEmail({
        nurseries,
        userName: user.display_name,
        postcode: user.home_postcode,
      })

      const result = await sendEmail({
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      })

      await logEmail({
        userId: user.id,
        emailTo: email,
        template: 'weekly_digest',
        subject: rendered.subject,
        resendId: result?.messageId,
      })

      sent++
    } catch (err) {
      logger.error({ err: err?.message, userId: user.id }, 'weeklyDigest: send failed')
      errors++
    }
  }

  logger.info({ sent, skipped, errors, totalUsers: users.length }, 'weeklyDigest: complete')
  return { sent, skipped, errors }
}

export default { sendWeeklyDigests }
