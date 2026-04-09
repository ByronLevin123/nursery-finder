// Drip sequence engine — processes scheduled drip emails for onboarding flows.

import db from '../db.js'
import { logger } from '../logger.js'
import { sendEmail } from './emailService.js'
import {
  renderWelcomeEmail,
  renderWelcomeDay3Email,
  renderWelcomeDay7Email,
} from './emailTemplates.js'

// ---------- Sequence definitions ----------

const SEQUENCES = {
  welcome: {
    steps: [
      { day: 0, template: 'welcome', render: renderWelcomeEmail },
      { day: 3, template: 'welcome_day3', render: renderWelcomeDay3Email },
      { day: 7, template: 'welcome_day7', render: renderWelcomeDay7Email },
    ],
  },
}

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
    logger.warn({ err: err?.message, template }, 'email_log insert failed')
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

async function getUserName(userId) {
  if (!db) return null
  try {
    const { data } = await db
      .from('user_profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
    return data?.display_name || null
  } catch {
    return null
  }
}

// ---------- public API ----------

export async function startSequence(userId, sequenceName) {
  if (!db) {
    logger.warn('dripEngine: db not configured, skipping startSequence')
    return null
  }
  const seq = SEQUENCES[sequenceName]
  if (!seq) {
    logger.warn({ sequenceName }, 'dripEngine: unknown sequence')
    return null
  }

  // Upsert — idempotent; the unique index on (user_id, sequence) prevents dupes.
  const { data, error } = await db
    .from('drip_sequences')
    .upsert(
      {
        user_id: userId,
        sequence: sequenceName,
        step: 0,
        started_at: new Date().toISOString(),
        next_send_at: new Date().toISOString(),
        completed: false,
        paused: false,
      },
      { onConflict: 'user_id,sequence', ignoreDuplicates: true }
    )
    .select()
    .maybeSingle()

  if (error) {
    logger.error({ err: error.message, userId, sequenceName }, 'dripEngine: startSequence failed')
    return null
  }

  logger.info({ userId, sequenceName }, 'dripEngine: sequence started')
  return data
}

export async function processDripQueue() {
  if (!db) {
    logger.warn('dripEngine: db not configured')
    return { processed: 0, errors: 0 }
  }

  const now = new Date().toISOString()

  // Fetch pending drip entries
  const { data: pending, error } = await db
    .from('drip_sequences')
    .select('*')
    .eq('completed', false)
    .eq('paused', false)
    .lte('next_send_at', now)
    .order('next_send_at', { ascending: true })
    .limit(200)

  if (error) {
    logger.error({ err: error.message }, 'dripEngine: query failed')
    return { processed: 0, errors: 1 }
  }
  if (!pending || pending.length === 0) {
    return { processed: 0, errors: 0 }
  }

  let processed = 0
  let errors = 0

  for (const row of pending) {
    try {
      const seq = SEQUENCES[row.sequence]
      if (!seq) {
        logger.warn({ sequence: row.sequence }, 'dripEngine: unknown sequence in queue')
        await db.from('drip_sequences').update({ completed: true }).eq('id', row.id)
        continue
      }

      const step = seq.steps[row.step]
      if (!step) {
        // Past last step — mark complete
        await db
          .from('drip_sequences')
          .update({ completed: true, next_send_at: null })
          .eq('id', row.id)
        continue
      }

      // Check marketing opt-out
      const { data: profile } = await db
        .from('user_profiles')
        .select('email_marketing, display_name')
        .eq('id', row.user_id)
        .maybeSingle()

      if (profile && profile.email_marketing === false) {
        await db.from('drip_sequences').update({ paused: true }).eq('id', row.id)
        logger.info(
          { userId: row.user_id, sequence: row.sequence },
          'dripEngine: paused — user opted out'
        )
        continue
      }

      const email = await getUserEmail(row.user_id)
      if (!email) {
        logger.warn({ userId: row.user_id }, 'dripEngine: no email found, skipping')
        errors++
        continue
      }

      const userName = profile?.display_name || null
      const rendered = step.render({ userName })

      const result = await sendEmail({
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      })

      await logEmail({
        userId: row.user_id,
        emailTo: email,
        template: step.template,
        subject: rendered.subject,
        resendId: result?.messageId,
      })

      // Advance to next step
      const nextStepIdx = row.step + 1
      const nextStep = seq.steps[nextStepIdx]

      if (nextStep) {
        const nextSendAt = new Date(row.started_at)
        nextSendAt.setDate(nextSendAt.getDate() + nextStep.day)
        await db
          .from('drip_sequences')
          .update({ step: nextStepIdx, next_send_at: nextSendAt.toISOString() })
          .eq('id', row.id)
      } else {
        await db
          .from('drip_sequences')
          .update({ completed: true, next_send_at: null })
          .eq('id', row.id)
      }

      processed++
    } catch (err) {
      logger.error(
        { err: err?.message, dripId: row.id, sequence: row.sequence },
        'dripEngine: step failed'
      )
      errors++
    }
  }

  logger.info({ processed, errors }, 'dripEngine: queue processed')
  return { processed, errors }
}

export default { startSequence, processDripQueue }
