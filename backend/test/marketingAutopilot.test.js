import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { createMockDb } from './helpers/mockDb.js'

const { db, getTable, resetAll } = createMockDb()
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
