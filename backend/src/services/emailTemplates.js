// Email lifecycle templates — each returns { subject, html, text }.
// Uses the same shell/escapeHtml pattern as emailService.js.

import { escapeHtml } from './emailService.js'

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://comparethenursery.com'
const UNSUBSCRIBE_URL = `${FRONTEND_URL}/account?tab=notifications`

// ---------- shared shell ----------

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
            <td style="padding:20px 24px;background:#4f46e5;color:#ffffff;font-size:18px;font-weight:700;">
              CompareTheNursery
            </td>
          </tr>
          <tr>
            <td style="padding:24px;font-size:15px;line-height:1.55;color:#1f2937;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
              You are receiving this because you used CompareTheNursery.
              <a href="${UNSUBSCRIBE_URL}" style="color:#4f46e5;">Manage email preferences</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(href, label) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;">${escapeHtml(label)}</a>`
}

// ---------- 1. Welcome email ----------

export function renderWelcomeEmail({ userName } = {}) {
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hi,'
  const subject = 'Welcome to CompareTheNursery!'

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">Welcome to CompareTheNursery — the easiest way to find and compare Ofsted-rated nurseries near you.</p>
      <p style="margin:0 0 8px 0;font-weight:600;">Here is how to get started:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
            <div style="font-weight:600;color:#4f46e5;">1. Take the nursery quiz</div>
            <div style="font-size:13px;color:#4b5563;">Answer a few questions and we will match you with nurseries that fit your family.</div>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
            <div style="font-weight:600;color:#4f46e5;">2. Search nurseries</div>
            <div style="font-size:13px;color:#4b5563;">Enter your postcode and explore nurseries on the map with Ofsted ratings, fees and reviews.</div>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0;">
            <div style="font-weight:600;color:#4f46e5;">3. Save your shortlist</div>
            <div style="font-size:13px;color:#4b5563;">Heart any nursery to save it. We will keep you updated when anything changes.</div>
          </td>
        </tr>
      </table>
      <p style="margin:20px 0 0 0;">
        ${ctaButton(`${FRONTEND_URL}/search`, 'Search nurseries near you')}
      </p>
    `,
  })

  const text = [
    greeting,
    '',
    'Welcome to CompareTheNursery!',
    '',
    'Here is how to get started:',
    '1. Take the nursery quiz — answer a few questions and we will match you.',
    '2. Search nurseries — enter your postcode and explore the map.',
    '3. Save your shortlist — heart any nursery to save it.',
    '',
    `Search nurseries: ${FRONTEND_URL}/search`,
    '',
    `Manage preferences: ${UNSUBSCRIBE_URL}`,
  ].join('\n')

  return { subject, html, text }
}

// ---------- 2. Welcome drip Day 3 ----------

export function renderWelcomeDay3Email({ userName } = {}) {
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hi,'
  const subject = 'Did you know you can compare nurseries side by side?'

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">
        Finding the right nursery is a big decision. Our comparison tool lets you
        put nurseries side by side so you can see Ofsted ratings, fees, funded places
        and reviews at a glance.
      </p>
      <p style="margin:0 0 20px 0;">
        ${ctaButton(`${FRONTEND_URL}/compare`, 'Compare nurseries')}
      </p>
      <p style="margin:0;font-size:13px;color:#6b7280;">Just reply to this email if you need any help.</p>
    `,
  })

  const text = [
    greeting,
    '',
    'Did you know you can compare nurseries side by side?',
    '',
    'Our comparison tool lets you put nurseries side by side to see Ofsted ratings, fees, funded places and reviews at a glance.',
    '',
    `Compare nurseries: ${FRONTEND_URL}/compare`,
    '',
    `Manage preferences: ${UNSUBSCRIBE_URL}`,
  ].join('\n')

  return { subject, html, text }
}

// ---------- 3. Welcome drip Day 7 ----------

export function renderWelcomeDay7Email({ userName } = {}) {
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hi,'
  const subject = 'Have you found the right area for your family?'

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">
        If you are considering a move, our area intelligence pages show you crime rates,
        school quality, property prices and nursery density for every postcode district in
        the UK.
      </p>
      <p style="margin:0 0 12px 0;">
        ${ctaButton(`${FRONTEND_URL}/find-an-area`, 'Explore areas')}
      </p>
      <p style="margin:12px 0 0 0;">
        Or try our <a href="${FRONTEND_URL}/assistant" style="color:#4f46e5;font-weight:600;">AI Family Move Assistant</a> — tell it what matters to you and it will recommend the best areas.
      </p>
    `,
  })

  const text = [
    greeting,
    '',
    'Have you found the right area for your family?',
    '',
    'Our area intelligence pages show crime rates, school quality, property prices and nursery density for every postcode district.',
    '',
    `Explore areas: ${FRONTEND_URL}/find-an-area`,
    `AI Assistant: ${FRONTEND_URL}/assistant`,
    '',
    `Manage preferences: ${UNSUBSCRIBE_URL}`,
  ].join('\n')

  return { subject, html, text }
}

// ---------- 4. Weekly digest ----------

function nurseryRowHtml(n) {
  const name = escapeHtml(n.name || 'Unnamed nursery')
  const grade = escapeHtml(n.ofsted_overall_grade || 'Not yet inspected')
  const town = escapeHtml(n.town || '')
  const postcode = escapeHtml(n.postcode || '')
  const urn = n.urn ? escapeHtml(n.urn) : ''
  const link = urn ? `${FRONTEND_URL}/nursery/${urn}` : '#'
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <a href="${link}" style="font-weight:600;color:#111827;text-decoration:none;">${name}</a>
        <div style="font-size:13px;color:#4b5563;">${grade}${town ? ' · ' + town : ''}${postcode ? ' · ' + postcode : ''}</div>
      </td>
    </tr>`
}

function nurseryRowText(n) {
  const parts = [n.name || 'Unnamed nursery']
  if (n.ofsted_overall_grade) parts.push(n.ofsted_overall_grade)
  if (n.town) parts.push(n.town)
  if (n.postcode) parts.push(n.postcode)
  return '- ' + parts.join(' · ')
}

export function renderWeeklyDigestEmail({ nurseries = [], userName, postcode } = {}) {
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hi,'
  const count = nurseries.length
  const subject =
    count > 0
      ? `${count} new ${count === 1 ? 'nursery' : 'nurseries'} near you this week`
      : 'Your weekly nursery update'

  const rows = nurseries.length
    ? nurseries.map(nurseryRowHtml).join('')
    : `<tr><td style="padding:10px 0;color:#6b7280;">No new nurseries near ${escapeHtml(postcode || 'you')} this week. We will keep looking!</td></tr>`

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">Here are the nurseries added or updated near ${escapeHtml(postcode || 'you')} in the last 7 days.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows}
      </table>
      <p style="margin:20px 0 0 0;">
        ${ctaButton(`${FRONTEND_URL}/search?postcode=${encodeURIComponent(postcode || '')}`, 'See all nurseries')}
      </p>
    `,
  })

  const text = [
    greeting,
    '',
    `New nurseries near ${postcode || 'you'} this week:`,
    '',
    ...(nurseries.length ? nurseries.map(nurseryRowText) : ['(none this week)']),
    '',
    `See all: ${FRONTEND_URL}/search?postcode=${encodeURIComponent(postcode || '')}`,
    '',
    `Manage preferences: ${UNSUBSCRIBE_URL}`,
  ].join('\n')

  return { subject, html, text }
}

// ---------- 5. Re-engagement (30 days inactive) ----------

export function renderReengagementEmail({ userName, postcode, newCount = 0 } = {}) {
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hi,'
  const safePostcode = escapeHtml(postcode || 'your area')
  const subject =
    newCount > 0
      ? `We miss you! ${newCount} new nurseries near ${postcode || 'you'}`
      : 'We miss you at CompareTheNursery'

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">
        It has been a while since you visited CompareTheNursery.
        ${newCount > 0 ? `Since then, <strong>${newCount} new nurseries</strong> have been added near ${safePostcode}.` : 'We have been busy adding new nurseries, reviews and features.'}
      </p>
      <p style="margin:0 0 20px 0;">
        ${ctaButton(`${FRONTEND_URL}/search${postcode ? '?postcode=' + encodeURIComponent(postcode) : ''}`, 'See what is new')}
      </p>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If you no longer want to hear from us, you can
        <a href="${UNSUBSCRIBE_URL}" style="color:#4f46e5;">update your email preferences</a>.
      </p>
    `,
  })

  const text = [
    greeting,
    '',
    'It has been a while since you visited CompareTheNursery.',
    newCount > 0
      ? `Since then, ${newCount} new nurseries have been added near ${postcode || 'your area'}.`
      : 'We have been busy adding new nurseries, reviews and features.',
    '',
    `See what is new: ${FRONTEND_URL}/search${postcode ? '?postcode=' + encodeURIComponent(postcode) : ''}`,
    '',
    `Manage preferences: ${UNSUBSCRIBE_URL}`,
  ].join('\n')

  return { subject, html, text }
}

// ---------- 6. Provider invite ----------

export function renderProviderInviteEmail({ nurseryName, urn } = {}) {
  const safeName = escapeHtml(nurseryName || 'your nursery')
  const subject = `Claim ${nurseryName || 'your nursery'} on CompareTheNursery`
  const claimUrl = urn
    ? `${FRONTEND_URL}/nursery/${encodeURIComponent(urn)}?claim=1`
    : `${FRONTEND_URL}/provider`

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 16px 0;">
        <strong>${safeName}</strong> is already listed on CompareTheNursery and parents are searching for it.
        Claim your free profile to take control.
      </p>
      <p style="margin:0 0 8px 0;font-weight:600;">Benefits of claiming your nursery:</p>
      <ul style="margin:0 0 16px 0;padding-left:18px;font-size:14px;color:#374151;">
        <li style="margin:4px 0;">Update your description, photos and opening hours</li>
        <li style="margin:4px 0;">Respond to parent enquiries directly</li>
        <li style="margin:4px 0;">See how many parents view and shortlist your nursery</li>
        <li style="margin:4px 0;">Appear higher in search results with a complete profile</li>
      </ul>
      <p style="margin:0 0 20px 0;">
        ${ctaButton(claimUrl, 'Claim your nursery')}
      </p>
      <p style="margin:0;font-size:13px;color:#6b7280;">This is a one-time invitation. If this is not relevant you can ignore this email.</p>
    `,
  })

  const text = [
    `${nurseryName || 'Your nursery'} is listed on CompareTheNursery and parents are searching for it.`,
    '',
    'Benefits of claiming:',
    '- Update your description, photos and opening hours',
    '- Respond to parent enquiries directly',
    '- See how many parents view and shortlist your nursery',
    '- Appear higher in search results',
    '',
    `Claim your nursery: ${claimUrl}`,
  ].join('\n')

  return { subject, html, text }
}

// ---------- 7. Saved-search new-nursery alerts ----------

export function renderSavedSearchAlertEmail({ searchResults = [], userName } = {}) {
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hi,'
  const totalNew = searchResults.reduce((sum, r) => sum + (r.nurseries?.length || 0), 0)
  const subject =
    totalNew > 0
      ? `${totalNew} new ${totalNew === 1 ? 'nursery' : 'nurseries'} matching your saved searches`
      : 'Saved search update from CompareTheNursery'

  const sections = searchResults
    .map((r) => {
      const searchName = escapeHtml(r.search?.name || r.search?.postcode || 'Saved search')
      const postcode = escapeHtml(r.search?.postcode || '')
      const heading = postcode && r.search?.name
        ? `${searchName} (${postcode})`
        : searchName

      const rows = (r.nurseries || []).slice(0, 5).map(nurseryRowHtml).join('')

      return `
        <div style="margin:0 0 20px 0;">
          <div style="font-weight:600;color:#111827;margin-bottom:6px;font-size:15px;">${heading}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${rows}
          </table>
        </div>`
    })
    .join('')

  const searchUrl = `${FRONTEND_URL}/search`

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">New nurseries have appeared in areas you are watching. Here is a summary:</p>
      ${sections}
      <p style="margin:20px 0 0 0;">
        ${ctaButton(searchUrl, 'Search nurseries')}
      </p>
    `,
  })

  const textLines = [greeting, '', 'New nurseries matching your saved searches:', '']
  for (const r of searchResults) {
    const label = r.search?.name || r.search?.postcode || 'Saved search'
    textLines.push(`# ${label}`)
    const nurseries = r.nurseries || []
    if (nurseries.length === 0) {
      textLines.push('  (no new nurseries)')
    } else {
      for (const n of nurseries.slice(0, 5)) {
        textLines.push(nurseryRowText(n))
      }
    }
    textLines.push('')
  }
  textLines.push(`Search nurseries: ${searchUrl}`)
  textLines.push('')
  textLines.push(`Manage preferences: ${UNSUBSCRIBE_URL}`)

  return { subject, html, text: textLines.join('\n') }
}

// ---------- 8. Provider enquiry digest ----------

export function renderProviderEnquiryDigestEmail({
  providerName,
  nurseryName,
  enquiryCount = 0,
  providerUrl,
} = {}) {
  const greeting = providerName ? `Hi ${escapeHtml(providerName)},` : 'Hi,'
  const safeName = escapeHtml(nurseryName || 'your nursery')
  const count = enquiryCount
  const subject = `You have ${count} new ${count === 1 ? 'enquiry' : 'enquiries'} this week`
  const safeUrl = escapeHtml(providerUrl || `${FRONTEND_URL}/provider`)

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">
        <strong>${safeName}</strong> received <strong>${count} new ${count === 1 ? 'enquiry' : 'enquiries'}</strong> from parents this week on CompareTheNursery.
      </p>
      <p style="margin:0 0 20px 0;">
        ${ctaButton(safeUrl, 'View enquiries')}
      </p>
      <p style="margin:0;font-size:13px;color:#6b7280;">Quick responses lead to more bookings — aim to reply within 24 hours.</p>
    `,
  })

  const text = [
    greeting,
    '',
    `${nurseryName || 'Your nursery'} received ${count} new ${count === 1 ? 'enquiry' : 'enquiries'} this week.`,
    '',
    `View enquiries: ${providerUrl || `${FRONTEND_URL}/provider`}`,
    '',
    `Manage preferences: ${UNSUBSCRIBE_URL}`,
  ].join('\n')

  return { subject, html, text }
}

export default {
  renderWelcomeEmail,
  renderWelcomeDay3Email,
  renderWelcomeDay7Email,
  renderWeeklyDigestEmail,
  renderReengagementEmail,
  renderSavedSearchAlertEmail,
  renderProviderInviteEmail,
  renderProviderEnquiryDigestEmail,
}
