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

// ---------- 8. Ofsted rating change ----------

export function renderOfstedChangeEmail({
  nurseryName,
  town,
  urn,
  previousGrade,
  newGrade,
  userName,
} = {}) {
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hi,'
  const safeName = escapeHtml(nurseryName || 'A nursery')
  const safeTown = escapeHtml(town || '')
  const safePrev = escapeHtml(previousGrade || 'Unknown')
  const safeNew = escapeHtml(newGrade || 'Unknown')
  const subject = `Ofsted rating change: ${nurseryName || 'A nursery'}`

  // Determine if this is an upgrade or downgrade for styling
  const gradeOrder = { Outstanding: 1, Good: 2, 'Requires Improvement': 3, Inadequate: 4 }
  const prevRank = gradeOrder[previousGrade] || 99
  const newRank = gradeOrder[newGrade] || 99
  const isUpgrade = newRank < prevRank
  const isDowngrade = newRank > prevRank

  const badgeColor = isUpgrade ? '#16a34a' : isDowngrade ? '#d97706' : '#6b7280'
  const badgeBg = isUpgrade ? '#f0fdf4' : isDowngrade ? '#fffbeb' : '#f9fafb'
  const changeLabel = isUpgrade ? 'Upgraded' : isDowngrade ? 'Downgraded' : 'Changed'

  const nurseryUrl = urn
    ? `${FRONTEND_URL}/nursery/${encodeURIComponent(urn)}`
    : `${FRONTEND_URL}/search`
  const safeUrl = escapeHtml(nurseryUrl)

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">
        <strong>${safeName}</strong>${safeTown ? ' in ' + safeTown : ''} has received a new Ofsted rating.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
        <tr>
          <td style="padding:16px;background:${badgeBg};border-radius:8px;border:1px solid ${badgeColor}20;">
            <div style="font-size:12px;font-weight:600;color:${badgeColor};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">${changeLabel}</div>
            <div style="font-size:15px;color:#374151;">
              <span style="text-decoration:line-through;color:#9ca3af;">${safePrev}</span>
              <span style="margin:0 8px;color:#9ca3af;">&rarr;</span>
              <span style="font-weight:700;color:${badgeColor};">${safeNew}</span>
            </div>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 20px 0;">
        ${ctaButton(nurseryUrl, 'View nursery profile')}
      </p>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        Ofsted ratings are sourced from the official register under the Open Government Licence.
      </p>
    `,
  })

  const text = [
    greeting,
    '',
    `${nurseryName || 'A nursery'}${town ? ' in ' + town : ''} has received a new Ofsted rating.`,
    '',
    `${changeLabel}: ${previousGrade || 'Unknown'} -> ${newGrade || 'Unknown'}`,
    '',
    `View nursery: ${nurseryUrl}`,
    '',
    `Manage preferences: ${UNSUBSCRIBE_URL}`,
  ].join('\n')

  return { subject, html, text }
}

// ---------- 9. Provider enquiry digest ----------

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

// ---------- 10. Enhanced weekly digest (notification preferences) ----------

export function renderEnhancedWeeklyDigestEmail({
  userName,
  postcode,
  newNurseries = [],
  ofstedChanges = [],
  newAnswers = [],
  newReviewCount = 0,
} = {}) {
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hi,'
  const subject = 'Your weekly nursery digest'
  const safePostcode = escapeHtml(postcode || 'your area')

  // Build sections
  const sections = []

  // New nurseries near saved searches
  if (newNurseries.length > 0) {
    const rows = newNurseries.slice(0, 5).map(nurseryRowHtml).join('')
    sections.push(`
      <div style="margin:0 0 20px 0;">
        <div style="font-weight:600;color:#111827;margin-bottom:6px;font-size:15px;">New nurseries near ${safePostcode}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${rows}
        </table>
      </div>`)
  }

  // Ofsted changes on shortlisted nurseries
  if (ofstedChanges.length > 0) {
    const changeRows = ofstedChanges.slice(0, 5).map((c) => {
      const name = escapeHtml(c.name || 'Nursery')
      const prev = escapeHtml(c.previous_grade || '?')
      const next = escapeHtml(c.new_grade || '?')
      const urn = c.urn ? escapeHtml(c.urn) : ''
      const link = urn ? `${FRONTEND_URL}/nursery/${urn}` : '#'
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <a href="${link}" style="font-weight:600;color:#111827;text-decoration:none;">${name}</a>
            <div style="font-size:13px;color:#4b5563;">
              <span style="text-decoration:line-through;color:#9ca3af;">${prev}</span>
              <span style="margin:0 6px;color:#9ca3af;">&rarr;</span>
              <span style="font-weight:600;color:#4f46e5;">${next}</span>
            </div>
          </td>
        </tr>`
    }).join('')

    sections.push(`
      <div style="margin:0 0 20px 0;">
        <div style="font-weight:600;color:#111827;margin-bottom:6px;font-size:15px;">Ofsted rating changes</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${changeRows}
        </table>
      </div>`)
  }

  // New answers to questions
  if (newAnswers.length > 0) {
    const answerRows = newAnswers.slice(0, 5).map((a) => {
      const nurseryName = escapeHtml(a.nursery_name || 'Nursery')
      const question = escapeHtml(a.question || '')
      const urn = a.urn ? escapeHtml(a.urn) : ''
      const link = urn ? `${FRONTEND_URL}/nursery/${urn}#qa` : '#'
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <a href="${link}" style="font-weight:600;color:#111827;text-decoration:none;">${nurseryName}</a>
            <div style="font-size:13px;color:#4b5563;">New answer to: "${question.slice(0, 80)}${question.length > 80 ? '...' : ''}"</div>
          </td>
        </tr>`
    }).join('')

    sections.push(`
      <div style="margin:0 0 20px 0;">
        <div style="font-weight:600;color:#111827;margin-bottom:6px;font-size:15px;">New answers to your questions</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${answerRows}
        </table>
      </div>`)
  }

  // New reviews on shortlisted nurseries
  if (newReviewCount > 0) {
    sections.push(`
      <div style="margin:0 0 20px 0;">
        <div style="font-weight:600;color:#111827;margin-bottom:6px;font-size:15px;">New reviews</div>
        <p style="margin:0;font-size:14px;color:#374151;">
          ${newReviewCount} new ${newReviewCount === 1 ? 'review has' : 'reviews have'} been posted on your shortlisted nurseries this week.
        </p>
      </div>`)
  }

  const hasContent = sections.length > 0
  const bodyContent = hasContent
    ? sections.join('')
    : `<p style="color:#6b7280;">No updates this week near ${safePostcode}. We will keep looking!</p>`

  const html = shell({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">Here is your weekly digest of nursery updates.</p>
      ${bodyContent}
      <p style="margin:20px 0 0 0;">
        ${ctaButton(`${FRONTEND_URL}/search?postcode=${encodeURIComponent(postcode || '')}`, 'Search nurseries')}
      </p>
    `,
  })

  // Plain text version
  const textLines = [greeting, '', 'Your weekly nursery digest', '']

  if (newNurseries.length > 0) {
    textLines.push(`## New nurseries near ${postcode || 'you'}`)
    newNurseries.slice(0, 5).forEach((n) => textLines.push(nurseryRowText(n)))
    textLines.push('')
  }
  if (ofstedChanges.length > 0) {
    textLines.push('## Ofsted rating changes')
    ofstedChanges.slice(0, 5).forEach((c) => {
      textLines.push(`- ${c.name || 'Nursery'}: ${c.previous_grade || '?'} -> ${c.new_grade || '?'}`)
    })
    textLines.push('')
  }
  if (newAnswers.length > 0) {
    textLines.push('## New answers to your questions')
    newAnswers.slice(0, 5).forEach((a) => {
      textLines.push(`- ${a.nursery_name || 'Nursery'}: "${(a.question || '').slice(0, 80)}"`)
    })
    textLines.push('')
  }
  if (newReviewCount > 0) {
    textLines.push(`## ${newReviewCount} new review${newReviewCount === 1 ? '' : 's'} on shortlisted nurseries`)
    textLines.push('')
  }
  if (!hasContent) {
    textLines.push('No updates this week. We will keep looking!')
    textLines.push('')
  }

  textLines.push(`Search nurseries: ${FRONTEND_URL}/search?postcode=${encodeURIComponent(postcode || '')}`)
  textLines.push('')
  textLines.push(`Manage preferences: ${UNSUBSCRIBE_URL}`)

  return { subject, html, text: textLines.join('\n') }
}

export default {
  renderWelcomeEmail,
  renderWelcomeDay3Email,
  renderWelcomeDay7Email,
  renderWeeklyDigestEmail,
  renderEnhancedWeeklyDigestEmail,
  renderReengagementEmail,
  renderSavedSearchAlertEmail,
  renderOfstedChangeEmail,
  renderProviderInviteEmail,
  renderProviderEnquiryDigestEmail,
}
