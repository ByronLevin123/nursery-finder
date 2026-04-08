import { describe, it, expect, vi } from 'vitest'
import {
  renderShortlistEmail,
  renderComparisonEmail,
  renderDigestEmail,
  renderClaimApprovedEmail,
  escapeHtml,
} from '../src/services/emailService.js'

const NURSERIES = [
  {
    urn: '100001',
    name: 'Sunny Days Nursery',
    ofsted_overall_grade: 'Outstanding',
    town: 'London',
    postcode: 'SW11 1AA',
  },
  {
    urn: '100002',
    name: 'Acorns & Oaks',
    ofsted_overall_grade: 'Good',
    town: 'Battersea',
    postcode: 'SW8 4NN',
  },
]

describe('renderShortlistEmail', () => {
  it('returns subject, html, text including nursery names', () => {
    const out = renderShortlistEmail({ nurseries: NURSERIES, userName: 'Byron' })
    expect(out.subject).toMatch(/2 nurseries/)
    expect(out.html).toContain('Sunny Days Nursery')
    expect(out.html).toContain('Acorns &amp; Oaks')
    expect(out.text).toContain('Sunny Days Nursery')
    expect(out.text).toContain('Acorns & Oaks')
  })

  it('handles empty nurseries array gracefully', () => {
    const out = renderShortlistEmail({ nurseries: [] })
    expect(out.subject).toBe('Your NurseryFinder shortlist')
    expect(out.html).toContain('shortlist is empty')
    expect(out.text).toContain('(empty shortlist)')
  })

  it('escapes HTML in nursery names to prevent injection', () => {
    const evil = [{ name: '<script>alert(1)</script>', ofsted_overall_grade: 'Good' }]
    const out = renderShortlistEmail({ nurseries: evil })
    expect(out.html).not.toContain('<script>alert(1)</script>')
    expect(out.html).toContain('&lt;script&gt;')
  })
})

describe('renderComparisonEmail', () => {
  it('produces subject mentioning the count and html with all names', () => {
    const out = renderComparisonEmail({ nurseries: NURSERIES, userName: 'Byron' })
    expect(out.subject).toMatch(/comparison/i)
    expect(out.subject).toMatch(/2/)
    expect(out.html).toContain('Sunny Days Nursery')
    expect(out.text).toBeTruthy()
    expect(out.text.length).toBeGreaterThan(10)
  })

  it('handles empty array', () => {
    const out = renderComparisonEmail({ nurseries: [] })
    expect(out.html).toContain('No nurseries to compare')
    expect(out.text).toContain('(no nurseries)')
  })
})

describe('renderDigestEmail', () => {
  it('renders saved-search sections with new matches', () => {
    const savedSearches = [
      { id: 's1', name: 'South London family areas', criteria: {} },
      { id: 's2', name: 'North London', criteria: {} },
    ]
    const newMatches = {
      s1: [{ postcode_district: 'SW11', family_score: 8.4 }],
      s2: [],
    }
    const out = renderDigestEmail({ savedSearches, newMatches, userName: 'Byron' })
    expect(out.subject).toMatch(/1 new match/)
    expect(out.html).toContain('South London family areas')
    expect(out.html).toContain('SW11')
    expect(out.text).toContain('SW11')
  })

  it('handles users with no saved searches', () => {
    const out = renderDigestEmail({ savedSearches: [], newMatches: {} })
    expect(out.subject).toBe('NurseryFinder digest')
    expect(out.html).toContain('no saved searches')
    expect(out.text).toBeTruthy()
  })
})

describe('renderClaimApprovedEmail', () => {
  it('includes the nursery name, CTA link, and subject line', () => {
    const out = renderClaimApprovedEmail(
      { name: 'Sunny Days Nursery', town: 'Battersea' },
      'https://example.com/provider'
    )
    expect(out.subject).toBe('Your claim for Sunny Days Nursery has been approved')
    expect(out.html).toContain('Sunny Days Nursery')
    expect(out.html).toContain('Battersea')
    expect(out.html).toContain('https://example.com/provider')
    expect(out.text).toContain('Sunny Days Nursery')
    expect(out.text).toContain('https://example.com/provider')
  })

  it('escapes HTML in the nursery name', () => {
    const out = renderClaimApprovedEmail(
      { name: '<script>bad</script>' },
      'https://example.com/provider'
    )
    expect(out.html).not.toContain('<script>bad</script>')
    expect(out.html).toContain('&lt;script&gt;')
  })

  it('renders with a missing nursery gracefully', () => {
    const out = renderClaimApprovedEmail({}, '/provider')
    expect(out.subject).toMatch(/your nursery/)
    expect(out.html).toContain('/provider')
  })
})

describe('sendEmail with mocked Resend (claim approved path)', () => {
  it('calls the Resend SDK when RESEND_API_KEY is configured', async () => {
    vi.resetModules()
    const send = vi.fn(async () => ({ data: { id: 'msg-123' }, error: null }))
    vi.doMock('resend', () => ({
      Resend: class {
        constructor() {
          this.emails = { send }
        }
      },
    }))
    process.env.RESEND_API_KEY = 'test-key'
    const mod = await import('../src/services/emailService.js')
    const rendered = mod.renderClaimApprovedEmail(
      { name: 'Sunny Days', town: 'London' },
      'https://example.com/provider'
    )
    const result = await mod.sendEmail({
      to: 'owner@example.com',
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    })
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0][0]
    expect(payload.to).toEqual(['owner@example.com'])
    expect(payload.subject).toMatch(/Sunny Days/)
    expect(payload.html).toContain('Sunny Days')
    expect(result.messageId).toBe('msg-123')
    delete process.env.RESEND_API_KEY
    vi.doUnmock('resend')
  })
})

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'
    )
  })

  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
})
