import { describe, it, expect } from 'vitest'
import {
  renderShortlistEmail,
  renderComparisonEmail,
  renderDigestEmail,
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
