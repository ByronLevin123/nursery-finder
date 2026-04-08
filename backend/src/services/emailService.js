// Email service — Resend-backed transactional email.
// The Resend SDK is loaded lazily so the rest of the app (and tests) can
// run without RESEND_API_KEY set. Pure render helpers do NOT touch Resend
// and are safe to import from tests.

import { logger } from '../logger.js'

const FROM = process.env.EMAIL_FROM || 'NurseryFinder <noreply@nursery-finder.vercel.app>'
const SEND_TIMEOUT_MS = 15_000
const UNSUBSCRIBE_URL = process.env.FRONTEND_URL
  ? `${process.env.FRONTEND_URL}/account`
  : 'https://nursery-finder.vercel.app/account'

let _client = null
let _clientInitTried = false

export class EmailNotConfiguredError extends Error {
  constructor(message = 'RESEND_API_KEY is not configured') {
    super(message)
    this.name = 'EmailNotConfiguredError'
  }
}

export class EmailSendError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = 'EmailSendError'
    if (cause) this.cause = cause
  }
}

export function isEmailAvailable() {
  return !!process.env.RESEND_API_KEY
}

async function getClient() {
  if (_client) return _client
  if (_clientInitTried && !_client) return null
  _clientInitTried = true
  if (!process.env.RESEND_API_KEY) return null
  try {
    const mod = await import('resend')
    const Resend = mod.Resend || mod.default?.Resend || mod.default
    _client = new Resend(process.env.RESEND_API_KEY)
    return _client
  } catch (err) {
    logger.warn({ err: err?.message }, 'failed to load Resend SDK')
    return null
  }
}

// Race a promise against a timeout — used because the Resend SDK does not
// expose a per-call timeout.
function withTimeout(promise, ms, label) {
  let to
  const timeout = new Promise((_, reject) => {
    to = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(to))
}

export async function sendEmail({ to, subject, html, text, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    throw new EmailNotConfiguredError()
  }
  if (!to || !subject || (!html && !text)) {
    throw new EmailSendError('sendEmail requires to, subject, and html or text')
  }
  const client = await getClient()
  if (!client) {
    throw new EmailNotConfiguredError('Resend SDK unavailable')
  }
  try {
    const payload = {
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    }
    if (replyTo) payload.reply_to = replyTo

    const result = await withTimeout(client.emails.send(payload), SEND_TIMEOUT_MS, 'resend.send')
    const messageId = result?.data?.id || result?.id || null
    if (result?.error) {
      throw new EmailSendError(result.error.message || 'Resend returned an error', result.error)
    }
    // NEVER log the body — only metadata.
    logger.info({ to: Array.isArray(to) ? to.length : 1, subject, messageId }, 'email sent')
    return { messageId }
  } catch (err) {
    logger.error({ err: err?.message, subject }, 'email send failed')
    if (err instanceof EmailSendError) throw err
    throw new EmailSendError(err?.message || 'Unknown email send error', err)
  }
}

// ---------- pure helpers (HTML/text rendering) ----------

export function escapeHtml(value) {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function shell({ title, bodyHtml }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;background:#2563eb;color:#ffffff;font-size:18px;font-weight:700;">
              NurseryFinder
            </td>
          </tr>
          <tr>
            <td style="padding:24px;font-size:15px;line-height:1.55;color:#1f2937;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
              You are receiving this because you used NurseryFinder.
              <a href="${UNSUBSCRIBE_URL}" style="color:#2563eb;">Manage email preferences</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function nurseryLineHtml(n) {
  const name = escapeHtml(n.name || 'Unnamed nursery')
  const grade = escapeHtml(n.ofsted_overall_grade || 'Not yet inspected')
  const town = escapeHtml(n.town || '')
  const postcode = escapeHtml(n.postcode || '')
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
        <div style="font-weight:600;color:#111827;">${name}</div>
        <div style="font-size:13px;color:#4b5563;">${grade}${town ? ' · ' + town : ''}${postcode ? ' · ' + postcode : ''}</div>
      </td>
    </tr>`
}

function nurseryLineText(n) {
  const parts = [n.name || 'Unnamed nursery']
  if (n.ofsted_overall_grade) parts.push(n.ofsted_overall_grade)
  if (n.town) parts.push(n.town)
  if (n.postcode) parts.push(n.postcode)
  return '- ' + parts.join(' · ')
}

export function renderShortlistEmail({ nurseries = [], userName } = {}) {
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hi,'
  const count = nurseries.length
  const subject =
    count === 0
      ? 'Your NurseryFinder shortlist'
      : `Your NurseryFinder shortlist (${count} ${count === 1 ? 'nursery' : 'nurseries'})`

  const rows = nurseries.length
    ? nurseries.map(nurseryLineHtml).join('')
    : `<tr><td style="padding:12px 0;color:#6b7280;">Your shortlist is empty.</td></tr>`

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">Here is the nursery shortlist you saved on NurseryFinder.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows}
      </table>
      <p style="margin:20px 0 0 0;font-size:13px;color:#6b7280;">Reply to this email if you'd like help comparing them.</p>
    `,
  })

  const textLines = [
    greeting,
    '',
    'Here is the nursery shortlist you saved on NurseryFinder:',
    '',
    ...(nurseries.length ? nurseries.map(nurseryLineText) : ['(empty shortlist)']),
    '',
    'Manage preferences: ' + UNSUBSCRIBE_URL,
  ]

  return { subject, html, text: textLines.join('\n') }
}

export function renderComparisonEmail({ nurseries = [], userName } = {}) {
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hi,'
  const count = nurseries.length
  const subject =
    count === 0
      ? 'Your NurseryFinder comparison'
      : `NurseryFinder comparison: ${count} ${count === 1 ? 'nursery' : 'nurseries'}`

  const rows = nurseries.length
    ? nurseries.map(nurseryLineHtml).join('')
    : `<tr><td style="padding:12px 0;color:#6b7280;">No nurseries to compare.</td></tr>`

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">Here is the side-by-side nursery comparison you put together on NurseryFinder.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows}
      </table>
      <p style="margin:20px 0 0 0;font-size:13px;color:#6b7280;">Open the website for the full side-by-side table.</p>
    `,
  })

  const textLines = [
    greeting,
    '',
    'Your NurseryFinder comparison:',
    '',
    ...(nurseries.length ? nurseries.map(nurseryLineText) : ['(no nurseries)']),
    '',
    'Manage preferences: ' + UNSUBSCRIBE_URL,
  ]

  return { subject, html, text: textLines.join('\n') }
}

export function renderDigestEmail({ savedSearches = [], newMatches = {}, userName } = {}) {
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hi,'
  const totalMatches = Object.values(newMatches).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0
  )
  const subject =
    totalMatches > 0
      ? `NurseryFinder digest: ${totalMatches} new ${totalMatches === 1 ? 'match' : 'matches'}`
      : 'NurseryFinder digest'

  const sections = savedSearches
    .map((s) => {
      const matches = newMatches[s.id] || []
      const name = escapeHtml(s.name || 'Saved search')
      const matchRows = matches.length
        ? matches
            .map(
              (m) =>
                `<li style="margin:4px 0;">${escapeHtml(
                  m.postcode_district || m.name || 'Match'
                )}${m.family_score != null ? ` — score ${escapeHtml(m.family_score)}` : ''}</li>`
            )
            .join('')
        : '<li style="margin:4px 0;color:#6b7280;">No new matches this period.</li>'
      return `
        <div style="margin:0 0 18px 0;">
          <div style="font-weight:600;color:#111827;margin-bottom:4px;">${name}</div>
          <ul style="margin:0;padding-left:18px;font-size:14px;color:#374151;">${matchRows}</ul>
        </div>`
    })
    .join('')

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">Here is your saved-search digest from NurseryFinder.</p>
      ${sections || '<p style="color:#6b7280;">You have no saved searches yet.</p>'}
    `,
  })

  const textLines = [greeting, '', 'Your NurseryFinder digest:', '']
  for (const s of savedSearches) {
    textLines.push(`# ${s.name || 'Saved search'}`)
    const matches = newMatches[s.id] || []
    if (!matches.length) {
      textLines.push('  (no new matches)')
    } else {
      for (const m of matches) {
        textLines.push(`  - ${m.postcode_district || m.name || 'Match'}`)
      }
    }
    textLines.push('')
  }
  textLines.push('Manage preferences: ' + UNSUBSCRIBE_URL)

  return { subject, html, text: textLines.join('\n') }
}

export function renderClaimApprovedEmail(nursery = {}, providerUrl = '') {
  const name = escapeHtml(nursery.name || 'your nursery')
  const town = escapeHtml(nursery.town || '')
  const safeUrl = escapeHtml(providerUrl || '/provider')
  const subject = `Your claim for ${nursery.name || 'your nursery'} has been approved`

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Good news,</p>
      <p style="margin:0 0 16px 0;">
        Your claim for <strong>${name}</strong>${town ? ' in ' + town : ''} has been approved.
        You can now manage the nursery's profile on NurseryFinder — update your description,
        photos, opening hours and contact details from your provider dashboard.
      </p>
      <p style="margin:20px 0;">
        <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;">
          Go to provider dashboard
        </a>
      </p>
      <p style="margin:20px 0 0 0;font-size:13px;color:#6b7280;">
        If you did not submit this claim, please reply to this email so we can investigate.
      </p>
    `,
  })

  const text = [
    'Good news,',
    '',
    `Your claim for ${nursery.name || 'your nursery'}${nursery.town ? ' in ' + nursery.town : ''} has been approved.`,
    '',
    `Manage your listing: ${providerUrl || '/provider'}`,
    '',
    'Manage preferences: ' + UNSUBSCRIBE_URL,
  ].join('\n')

  return { subject, html, text }
}

export default {
  isEmailAvailable,
  sendEmail,
  renderShortlistEmail,
  renderComparisonEmail,
  renderDigestEmail,
  renderClaimApprovedEmail,
  EmailNotConfiguredError,
  EmailSendError,
}
