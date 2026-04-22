import { describe, it, expect } from 'vitest'
import { renderEnquiryNotificationEmail, escapeHtml } from '../src/services/emailService.js'

describe('renderEnquiryNotificationEmail', () => {
  it('returns subject, html, and text with nursery name', () => {
    const out = renderEnquiryNotificationEmail({
      nurseryName: 'Sunny Days',
      parentName: 'parent@example.com',
      childName: 'Alice',
      childAgeMonths: 18,
      preferredStart: '2026-09-01',
      sessionPreference: 'full_day',
      message: 'We are very interested!',
      providerUrl: 'https://example.com/provider',
    })
    expect(out.subject).toContain('Sunny Days')
    expect(out.subject).toContain('NurseryMatch')
    expect(out.html).toContain('Sunny Days')
    expect(out.html).toContain('Alice')
    expect(out.html).toContain('18 months old')
    expect(out.html).toContain('2026-09-01')
    expect(out.html).toContain('full_day')
    expect(out.html).toContain('We are very interested!')
    expect(out.html).toContain('View &amp; respond')
    expect(out.text).toContain('Sunny Days')
    expect(out.text).toContain('Alice')
  })

  it('handles missing optional fields gracefully', () => {
    const out = renderEnquiryNotificationEmail({
      nurseryName: 'Bright Start',
    })
    expect(out.subject).toContain('Bright Start')
    expect(out.html).toContain('Bright Start')
    expect(out.text).toContain('Bright Start')
    // Should not contain undefined text
    expect(out.html).not.toContain('undefined')
    expect(out.text).not.toContain('undefined')
  })

  it('escapes HTML in inputs', () => {
    const out = renderEnquiryNotificationEmail({
      nurseryName: '<script>alert(1)</script>',
      childName: '<b>evil</b>',
    })
    expect(out.html).not.toContain('<script>alert(1)</script>')
    expect(out.html).toContain('&lt;script&gt;')
    expect(out.html).not.toContain('<b>evil</b>')
  })

  it('uses default provider URL when none provided', () => {
    const out = renderEnquiryNotificationEmail({
      nurseryName: 'Test',
    })
    expect(out.html).toContain('/provider')
    expect(out.text).toContain('/provider')
  })
})
