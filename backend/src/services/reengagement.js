// Re-engagement emails — sent to users inactive for 30+ days.

import db from '../db.js'
import { logger } from '../logger.js'
import { sendEmail } from './emailService.js'
import { renderReengagementEmail } from './emailTemplates.js'

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
    logger.warn({ err: err?.message, template }, 'reengagement: email_log insert failed')
  }
}

function postcodeDistrict(postcode) {
  if (!postcode) return null
  const clean = postcode.replace(/\s+/g, '').toUpperCase()
  if (clean.length < 4) return clean
  return clean.slice(0, clean.length - 3).trim()
}

export async function sendReengagementEmails() {
  if (!db) {
    logger.warn('reengagement: db not configured')
    return { sent: 0, skipped: 0, errors: 0 }
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoff = thirtyDaysAgo.toISOString()

  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  const reengagementCutoff = sixtyDaysAgo.toISOString()

  // Find users who have been inactive for 30+ days and opted into marketing
  const { data: users, error: usersErr } = await db
    .from('user_profiles')
    .select('id, display_name, home_postcode')
    .eq('email_marketing', true)
    .lt('last_active_at', cutoff)
    .not('last_active_at', 'is', null)
    .limit(500)

  if (usersErr) {
    logger.error({ err: usersErr.message }, 'reengagement: user query failed')
    return { sent: 0, skipped: 0, errors: 1 }
  }

  if (!users || users.length === 0) {
    logger.info('reengagement: no eligible users')
    return { sent: 0, skipped: 0, errors: 0 }
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const user of users) {
    try {
      // Check if we already sent a re-engagement email in the last 60 days
      const { data: recentSends, error: logErr } = await db
        .from('email_log')
        .select('id')
        .eq('user_id', user.id)
        .eq('template', 'reengagement')
        .gte('created_at', reengagementCutoff)
        .limit(1)

      if (logErr) {
        errors++
        continue
      }
      if (recentSends && recentSends.length > 0) {
        skipped++
        continue
      }

      // Get user email
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

      // Count new nurseries near their postcode
      let newCount = 0
      const district = postcodeDistrict(user.home_postcode)
      if (district) {
        const { count, error: countErr } = await db
          .from('nurseries')
          .select('id', { count: 'exact', head: true })
          .ilike('postcode', `${district}%`)
          .gte('created_at', cutoff)

        if (!countErr) newCount = count || 0
      }

      const rendered = renderReengagementEmail({
        userName: user.display_name,
        postcode: user.home_postcode,
        newCount,
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
        template: 'reengagement',
        subject: rendered.subject,
        resendId: result?.messageId,
      })

      sent++
    } catch (err) {
      logger.error({ err: err?.message, userId: user.id }, 'reengagement: send failed')
      errors++
    }
  }

  logger.info({ sent, skipped, errors, totalUsers: users.length }, 'reengagement: complete')
  return { sent, skipped, errors }
}

export default { sendReengagementEmails }
