import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { createMockDb } from './helpers/mockDb.js'

const { db, getTable, setTable, resetAll } = createMockDb()
vi.mock('../src/db.js', () => ({ default: db }))

const h = vi.hoisted(() => ({
  claude: true,
  buffer: true,
  profiles: [{ id: 'ch-1', service: 'twitter' }],
  createdPosts: [],
}))

vi.mock('../src/services/claudeApi.js', () => ({
  isClaudeAvailable: () => h.claude,
  callClaude: async () => 'Compare nurseries near you and find the right fit.',
}))

vi.mock('../src/services/bufferService.js', () => ({
  isAvailable: () => h.buffer,
  getProfiles: async () => ({ data: h.profiles, error: null }),
  createPost: async (opts) => {
    h.createdPosts.push(opts)
    return { data: { id: `post-${opts.channelId}` }, error: null }
  },
}))

let mod

beforeAll(async () => {
  mod = await import('../src/services/marketingAutopilot.js')
})

beforeEach(() => {
  resetAll({})
  h.claude = true
  h.buffer = true
  h.profiles = [{ id: 'ch-1', service: 'twitter' }]
  h.createdPosts = []
  process.env.MARKETING_AUTOPILOT_ENABLED = 'true'
  process.env.FRONTEND_URL = 'https://nurserymatch.com'
  delete process.env.MARKETING_DEFAULT_IMAGE_URL
})

afterEach(() => {
  delete process.env.MARKETING_AUTOPILOT_ENABLED
  delete process.env.MARKETING_DEFAULT_IMAGE_URL
})

describe('pure helpers', () => {
  it('withUtm appends tracking params and respects existing query', () => {
    expect(mod.withUtm('https://x.com')).toContain('utm_source=social')
    expect(mod.withUtm('https://x.com?a=1')).toMatch(/\?a=1&utm_source=social/)
  })

  it('pickTheme is stable for a given day and cycles across days', () => {
    const d1 = new Date('2026-06-01T00:00:00Z')
    const d2 = new Date('2026-06-01T23:00:00Z')
    expect(mod.pickTheme(d1)).toBe(mod.pickTheme(d2))
    const themes = new Set()
    for (let i = 0; i < mod.THEMES.length; i++) {
      themes.add(mod.pickTheme(new Date(Date.UTC(2026, 0, 1 + i))))
    }
    expect(themes.size).toBe(mod.THEMES.length)
  })

  it('buildBrief localises the local theme', () => {
    expect(mod.buildBrief('local', { district: 'SW1A' })).toContain('SW1A')
    expect(mod.buildBrief('funded-hours')).toMatch(/funded/i)
  })

  it('landingPath deep-links each theme to its highest-intent page', () => {
    expect(mod.landingPath('local', { district: 'SW1A' })).toBe('/nurseries-in/sw1a')
    expect(mod.landingPath('local')).toBe('/search')
    expect(mod.landingPath('visit-checklist')).toBe('/guides/questions-to-ask-nursery-visit')
    expect(mod.landingPath('ofsted-ratings')).toBe('/search')
  })

  it('postcodeDistrict extracts the outward code', () => {
    expect(mod.postcodeDistrict('SW1A 1AA')).toBe('SW1A')
    expect(mod.postcodeDistrict('m11ae')).toBe('M1')
    expect(mod.postcodeDistrict(null)).toBe(null)
  })
})

describe('runNewNurseriesRoundup', () => {
  it('posts a roundup for the district with the most new nurseries, deep-linked', async () => {
    const now = new Date()
    const recent = (d) => new Date(now.getTime() - d * 86400000).toISOString()
    setTable('nurseries', [
      { urn: '1', name: 'A', postcode: 'SW1A 1AA', created_at: recent(1) },
      { urn: '2', name: 'B', postcode: 'SW1A 2BB', created_at: recent(2) },
      { urn: '3', name: 'C', postcode: 'M1 1AE', created_at: recent(3) },
    ])
    const r = await mod.runNewNurseriesRoundup({ force: true })
    expect(r.district).toBe('SW1A')
    expect(r.count).toBe(2)
    expect(r.posted).toBe(1)
    expect(h.createdPosts[0].text).toContain('/nurseries-in/sw1a')
    expect(h.createdPosts[0].text).toContain('utm_campaign=roundup')
  })

  it('skips when there are no new nurseries in the window', async () => {
    setTable('nurseries', [])
    const r = await mod.runNewNurseriesRoundup({ force: true })
    expect(r.skipped).toMatch(/no new nurseries/i)
    expect(h.createdPosts).toHaveLength(0)
  })

  it('skips when disabled and not forced', async () => {
    process.env.MARKETING_AUTOPILOT_ENABLED = 'false'
    const r = await mod.runNewNurseriesRoundup()
    expect(r.skipped).toBeTruthy()
  })
})

describe('runAutopilot', () => {
  it('skips when disabled and not forced', async () => {
    process.env.MARKETING_AUTOPILOT_ENABLED = 'false'
    const r = await mod.runAutopilot()
    expect(r.skipped).toBeTruthy()
    expect(h.createdPosts).toHaveLength(0)
  })

  it('runs when forced even if disabled', async () => {
    process.env.MARKETING_AUTOPILOT_ENABLED = 'false'
    const r = await mod.runAutopilot({ force: true })
    expect(r.posted).toBe(1)
  })

  it('generates a UTM-tagged post and queues it to channels + records it', async () => {
    const r = await mod.runAutopilot()
    expect(r.posted).toBe(1)
    expect(h.createdPosts[0].text).toContain('utm_campaign=autopilot')
    expect(h.createdPosts[0].text).toContain('nurserymatch.com')
    expect(getTable('marketing_posts')).toHaveLength(1)
    expect(getTable('marketing_content')).toHaveLength(1)
  })

  it('skips Instagram when no default image is configured', async () => {
    h.profiles = [{ id: 'ig-1', service: 'instagram' }]
    const r = await mod.runAutopilot()
    expect(r.posted).toBe(0)
    expect(r.results[0].skipped).toMatch(/image/i)
  })

  it('posts to Instagram with the default image when configured', async () => {
    process.env.MARKETING_DEFAULT_IMAGE_URL = 'https://nurserymatch.com/instagram/promo.png'
    h.profiles = [{ id: 'ig-1', service: 'instagram' }]
    const r = await mod.runAutopilot()
    expect(r.posted).toBe(1)
    expect(h.createdPosts[0].imageUrl).toContain('promo.png')
  })

  it('skips gracefully when Buffer has no channels', async () => {
    h.profiles = []
    const r = await mod.runAutopilot()
    expect(r.skipped).toMatch(/channels/i)
  })

  it('skips when Claude is not configured', async () => {
    h.claude = false
    const r = await mod.runAutopilot()
    expect(r.skipped).toMatch(/claude/i)
  })
})

describe('runContentSyndication', () => {
  it('shares a real guide with a tracked /guides link', async () => {
    const r = await mod.runContentSyndication({ force: true })
    expect(r.posted).toBe(1)
    expect(r.slug).toBeTruthy()
    expect(h.createdPosts[0].text).toContain('/guides/')
    expect(h.createdPosts[0].text).toContain('utm_campaign=content')
  })

  it('works without Claude by falling back to the guide excerpt', async () => {
    h.claude = false
    const r = await mod.runContentSyndication({ force: true })
    expect(r.posted).toBe(1)
  })

  it('skips when disabled and not forced', async () => {
    process.env.MARKETING_AUTOPILOT_ENABLED = 'false'
    const r = await mod.runContentSyndication()
    expect(r.skipped).toBeTruthy()
  })

  it('skips when Buffer has no channels', async () => {
    h.profiles = []
    const r = await mod.runContentSyndication({ force: true })
    expect(r.skipped).toMatch(/channels/i)
  })
})
