// Notification service — creates in-app notifications and sends companion emails.

import db from '../db.js'
import { logger } from '../logger.js'
import { sendEmail, isEmailAvailable, escapeHtml } from './emailService.js'

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://nurserymatch.com'
const FROM = process.env.EMAIL_FROM || 'NurseryMatch <hello@nurserymatch.com>'

// ---------- core helpers ----------

export async function createNotification({ userId, type, title, body, link }) {
  if (!db) {
    logger.warn('createNotification called but db not configured')
    return null
  }
  try {
    const { data, error } = await db
      .from('notifications')
      .insert({ user_id: userId, type, title, body, link })
      .select()
      .single()
    if (error) throw error
    logger.info({ userId, type }, 'notification created')
    return data
  } catch (err) {
    logger.error({ err: err?.message, userId, type }, 'failed to create notification')
    return null
  }
}

export async function sendNotificationEmail({ to, subject, preheader, bodyHtml }) {
  if (!isEmailAvailable()) {
    logger.debug('sendNotificationEmail skipped — email not configured')
    return null
  }
  try {
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
${preheader ? `<span style="display:none;font-size:1px;color:#f6f7f9;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</span>` : ''}
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;background:#2563eb;color:#ffffff;font-size:18px;font-weight:700;">
              NurseryMatch
            </td>
          </tr>
          <tr>
            <td style="padding:24px;font-size:15px;line-height:1.55;color:#1f2937;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
              You are receiving this because you used NurseryMatch.
              <a href="${FRONTEND_URL}/account" style="color:#2563eb;">Manage email preferences</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const result = await sendEmail({ to, subject, html })
    return result
  } catch (err) {
    logger.warn({ err: err?.message, to, subject }, 'notification email send failed')
    return null
  }
}

// ---------- high-level notification triggers ----------

const STATUS_LABELS = {
  sent: 'Sent',
  opened: 'Opened',
  responded: 'Responded',
  visit_booked: 'Visit booked',
  place_offered: 'Place offered',
  accepted: 'Accepted',
  declined: 'Declined',
}

export async function notifyEnquiryStatusChange(enquiry, oldStatus, newStatus) {
  if (!enquiry || !enquiry.user_id) return

  const nurseryName = enquiry.nursery_name || 'a nursery'
  const label = STATUS_LABELS[newStatus] || newStatus
  const title = `Enquiry update: ${label}`
  const body = `Your enquiry to ${nurseryName} has been updated to "${label}".`
  const link = `${FRONTEND_URL}/applications`

  const notification = await createNotification({
    userId: enquiry.user_id,
    type: 'enquiry_status',
    title,
    body,
    link,
  })

  // Update email_sent flag after sending
  if (notification) {
    // Look up parent email
    try {
      const { data: profile } = await db
        .from('user_profiles')
        .select('id')
        .eq('id', enquiry.user_id)
        .maybeSingle()

      // Get email from auth — use the user_id to look up via profiles or enquiry data
      const parentEmail = enquiry.parent_email || null
      if (parentEmail) {
        const emailResult = await sendNotificationEmail({
          to: parentEmail,
          subject: title,
          preheader: body,
          bodyHtml: `
            <p style="margin:0 0 12px 0;">Hi,</p>
            <p style="margin:0 0 16px 0;">${escapeHtml(body)}</p>
            <p style="margin:20px 0;">
              <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;">
                View your applications
              </a>
            </p>
          `,
        })

        if (emailResult && notification) {
          await db
            .from('notifications')
            .update({ email_sent: true })
            .eq('id', notification.id)
            .catch((err) => { logger.warn({ err: err?.message, notificationId: notification.id }, 'Failed to mark notification email_sent') })
        }
      }
    } catch (err) {
      logger.warn({ err: err?.message }, 'notifyEnquiryStatusChange email lookup failed')
    }
  }

  return notification
}

export async function notifyNewMessage(enquiryId, message, recipientId) {
  if (!recipientId) return

  const senderLabel = message.sender_role === 'parent' ? 'Parent' : 'Provider'
  const title = `New message from ${senderLabel}`
  const preview = message.body?.length > 80 ? message.body.slice(0, 80) + '...' : message.body
  const link =
    message.sender_role === 'parent'
      ? `${FRONTEND_URL}/provider/enquiries`
      : `${FRONTEND_URL}/applications`

  const notification = await createNotification({
    userId: recipientId,
    type: 'new_message',
    title,
    body: preview,
    link,
  })

  if (notification && isEmailAvailable()) {
    try {
      // Look up recipient email from the enquiry
      const { data: enquiry } = await db
        .from('enquiries')
        .select('user_id, nursery_id, nurseries(name, contact_email, claimed_by_user_id)')
        .eq('id', enquiryId)
        .maybeSingle()

      let recipientEmail = null
      let nurseryName = 'a nursery'

      if (enquiry) {
        const nursery = enquiry.nurseries
        nurseryName = nursery?.name || nurseryName

        if (message.sender_role === 'parent' && nursery?.contact_email) {
          recipientEmail = nursery.contact_email
        } else if (message.sender_role === 'provider' && enquiry.user_id === recipientId) {
          // Look up parent email from parent_email field on enquiry
          const { data: fullEnquiry } = await db
            .from('enquiries')
            .select('parent_email')
            .eq('id', enquiryId)
            .maybeSingle()
          recipientEmail = fullEnquiry?.parent_email
        }
      }

      if (recipientEmail) {
        const subject = `New message about ${escapeHtml(nurseryName)}`
        const bodyHtml = `
          <p>You have a new message in your enquiry about <strong>${escapeHtml(nurseryName)}</strong>.</p>
          <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
            <p style="margin:0;color:#374151;">${escapeHtml(preview)}</p>
          </div>
          <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">View &amp; reply</a></p>
        `
        await sendNotificationEmail({ to: recipientEmail, subject, preheader: preview, bodyHtml })
        await db.from('notifications').update({ email_sent: true }).eq('id', notification.id)
        logger.info({ recipientId, enquiryId }, 'new message email sent')
      } else {
        logger.info({ recipientId, type: 'new_message' }, 'notification created, no email (recipient email unknown)')
      }
    } catch (err) {
      logger.warn({ err: err?.message }, 'notifyNewMessage email failed')
    }
  }

  return notification
}

export async function notifyVisitReminder(booking) {
  if (!booking || !booking.user_id) return

  const nurseryName = booking.nursery_name || 'your nursery visit'
  const slotDate = booking.slot_date || 'tomorrow'
  const slotTime = booking.slot_time || ''
  const title = 'Visit reminder: tomorrow'
  const body = `Reminder: you have a visit at ${nurseryName} tomorrow${slotTime ? ' at ' + slotTime : ''}.`
  const link = `${FRONTEND_URL}/applications`

  const notification = await createNotification({
    userId: booking.user_id,
    type: 'visit_reminder',
    title,
    body,
    link,
  })

  // Send reminder email if we have the user's email
  if (notification && booking.user_email) {
    const emailResult = await sendNotificationEmail({
      to: booking.user_email,
      subject: title,
      preheader: body,
      bodyHtml: `
        <p style="margin:0 0 12px 0;">Hi,</p>
        <p style="margin:0 0 16px 0;">${escapeHtml(body)}</p>
        <p style="margin:0 0 16px 0;">
          <strong>Date:</strong> ${escapeHtml(String(slotDate))}<br>
          ${slotTime ? `<strong>Time:</strong> ${escapeHtml(slotTime)}<br>` : ''}
        </p>
        <p style="margin:20px 0;">
          <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;">
            View your visits
          </a>
        </p>
      `,
    })

    if (emailResult) {
      await db
        .from('notifications')
        .update({ email_sent: true })
        .eq('id', notification.id)
        .catch((err) => { logger.warn({ err: err?.message, notificationId: notification.id }, 'Failed to mark notification email_sent') })
    }
  }

  return notification
}

export default {
  createNotification,
  sendNotificationEmail,
  notifyEnquiryStatusChange,
  notifyNewMessage,
  notifyVisitReminder,
}
