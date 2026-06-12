import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// supabaseAuth.js reads these at module load.
process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_ANON_KEY = 'anon-test-key'

import { createMockDb } from './helpers/mockDb.js'
import { createAuthMock } from './helpers/testApp.js'

const { db, getTable, resetAll } = createMockDb({
  user_profiles: [
    { id: 'admin-1', role: 'admin' },
    { id: 'user-1', role: 'customer' },
  ],
})
vi.mock('../src/db.js', () => ({ default: db }))

const { supabaseMock } = createAuthMock({
  'admin-token': { id: 'admin-1', email: 'admin@example.com' },
  'user-token': { id: 'user-1', email: 'user@example.com' },
})
vi.mock('@supabase/supabase-js', () => supabaseMock)

// Toggleable service availability via hoisted state.
const h = vi.hoisted(() => ({
  claudeAvailable: true,
  bufferAvailable: true,
  adsAvailable: true,
  profiles: [
    { id: 'ch-1', service: 'twitter', service_username: 'nm', avatar_url: null, connected: true },
  ],
}))

vi.mock('../src/services/claudeApi.js', () => ({
  isClaudeAvailable: () => h.claudeAvailable,
  callClaude: async () => 'Generated marketing copy about funded hours.',
}))

vi.mock('../src/services/bufferService.js', () => ({
  isAvailable: () => h.bufferAvailable,
  getProfiles: async () => ({ data: h.profiles, error: null }),
  createPost: async ({ channelId }) => ({ data: { id: `post-${channelId}` }, error: null }),
}))

vi.mock('../src/services/googleAdsService.js', () => ({
  isAvailable: () => h.adsAvailable,
  createCampaign: async () => ({ data: { campaignId: 'gc-1', status: 'paused' }, error: null }),
  listCampaigns: async () => ({ data: [], error: null }),
  pauseCampaign: async () => ({ data: {}, error: null }),
  resumeCampaign: async () => ({ data: {}, error: null }),
}))

let app
let request

beforeAll(async () => {
  app = (await import('../src/app.js')).default
  request = (await import('supertest')).default
})

beforeEach(() => {
  resetAll({
    user_profiles: [
      { id: 'admin-1', role: 'admin' },
      { id: 'user-1', role: 'customer' },
    ],
  })
  h.claudeAvailable = true
  h.bufferAvailable = true
  h.adsAvailable = true
  h.profiles = [
    { id: 'ch-1', service: 'twitter', service_username: 'nm', avatar_url: null, connected: true },
  ]
})

const asAdmin = (req) => req.set('Authorization', 'Bearer admin-token')

describe('auth', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/admin/marketing/content')
    expect(res.status).toBe(401)
  })

  it('rejects non-admin users with 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/marketing/content')
      .set('Authorization', 'Bearer user-token')
    expect(res.status).toBe(403)
  })
})

describe('POST /generate-content', () => {
  it('returns 503 when Claude is unavailable', async () => {
    h.claudeAvailable = false
    const res = await asAdmin(request(app).post('/api/v1/admin/marketing/generate-content')).send({
      content_type: 'social_post',
      topic: 'funded hours',
    })
    expect(res.status).toBe(503)
  })

  it('validates content_type and topic', async () => {
    const res = await asAdmin(request(app).post('/api/v1/admin/marketing/generate-content')).send({
      topic: 'missing type',
    })
    expect(res.status).toBe(400)
  })

  it('rejects an unknown content_type', async () => {
    const res = await asAdmin(request(app).post('/api/v1/admin/marketing/generate-content')).send({
      content_type: 'tiktok_dance',
      topic: 'x',
    })
    expect(res.status).toBe(400)
  })

  it('generates content and saves a draft', async () => {
    const res = await asAdmin(request(app).post('/api/v1/admin/marketing/generate-content')).send({
      content_type: 'social_post',
      platform: 'instagram',
      topic: 'funded childcare hours',
      tone: 'friendly',
    })
    expect(res.status).toBe(200)
    expect(res.body.content).toContain('Generated marketing copy')
    expect(res.body.content_type).toBe('social_post')
    expect(getTable('marketing_content')).toHaveLength(1)
    // Legacy type column stays populated for the 059 constraint.
    expect(getTable('marketing_content')[0].type).toBe('social')
  })
})

describe('social', () => {
  it('GET /social/profiles returns 503 when Buffer is not configured', async () => {
    h.bufferAvailable = false
    const res = await asAdmin(request(app).get('/api/v1/admin/marketing/social/profiles'))
    expect(res.status).toBe(503)
  })

  it('GET /social/profiles returns channels', async () => {
    const res = await asAdmin(request(app).get('/api/v1/admin/marketing/social/profiles'))
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].id).toBe('ch-1')
  })

  it('POST /social/post validates text and profile_ids', async () => {
    const res = await asAdmin(request(app).post('/api/v1/admin/marketing/social/post')).send({
      text: 'hi',
      profile_ids: [],
    })
    expect(res.status).toBe(400)
  })

  it('POST /social/post rejects non-string profile_ids (400)', async () => {
    const res = await asAdmin(request(app).post('/api/v1/admin/marketing/social/post')).send({
      text: 'hi',
      profile_ids: [{ injected: true }],
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/strings/i)
  })

  it('POST /social/post rejects a non-http image_url (400)', async () => {
    const res = await asAdmin(request(app).post('/api/v1/admin/marketing/social/post')).send({
      text: 'hi',
      profile_ids: ['ch-1'],
      image_url: 'javascript:alert(1)',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/http/i)
  })

  it('POST /social/post posts to channels and records the post', async () => {
    const res = await asAdmin(request(app).post('/api/v1/admin/marketing/social/post')).send({
      text: 'Find your nursery',
      profile_ids: ['ch-1'],
    })
    expect(res.status).toBe(200)
    expect(res.body.posted).toBe(1)
    const rows = getTable('marketing_posts')
    expect(rows).toHaveLength(1)
    expect(rows[0].platforms).toEqual(['twitter'])
    expect(rows[0].status).toBe('posted')
  })

  it('POST /social/post stores the image_url when provided', async () => {
    const res = await asAdmin(request(app).post('/api/v1/admin/marketing/social/post')).send({
      text: 'Look at our new nursery',
      profile_ids: ['ch-1'],
      image_url: 'https://nurserymatch.com/instagram/promo.png',
    })
    expect(res.status).toBe(200)
    const rows = getTable('marketing_posts')
    expect(rows[0].image_url).toBe('https://nurserymatch.com/instagram/promo.png')
  })

  it('POST /social/post rejects an Instagram post with no image (400)', async () => {
    h.profiles = [
      {
        id: 'ig-1',
        service: 'instagram',
        service_username: 'nm',
        avatar_url: null,
        connected: true,
      },
    ]
    const res = await asAdmin(request(app).post('/api/v1/admin/marketing/social/post')).send({
      text: 'No image here',
      profile_ids: ['ig-1'],
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/instagram/i)
  })

  it('POST /social/post allows an Instagram post when an image is attached', async () => {
    h.profiles = [
      {
        id: 'ig-1',
        service: 'instagram',
        service_username: 'nm',
        avatar_url: null,
        connected: true,
      },
    ]
    const res = await asAdmin(request(app).post('/api/v1/admin/marketing/social/post')).send({
      text: 'With an image',
      profile_ids: ['ig-1'],
      image_url: 'https://nurserymatch.com/instagram/promo.png',
    })
    expect(res.status).toBe(200)
    expect(res.body.posted).toBe(1)
  })
})

describe('ads', () => {
  it('POST /ads/campaigns returns 503 when Google Ads is not configured', async () => {
    h.adsAvailable = false
    const res = await asAdmin(request(app).post('/api/v1/admin/marketing/ads/campaigns')).send({
      name: 'Test',
      daily_budget: 10,
    })
    expect(res.status).toBe(503)
  })

  it('POST /ads/campaigns creates and returns the UI-shaped campaign', async () => {
    const res = await asAdmin(request(app).post('/api/v1/admin/marketing/ads/campaigns')).send({
      name: 'Nursery Search',
      daily_budget: 12.5,
      keywords: ['nursery near me'],
      headlines: ['Find a nursery'],
      descriptions: ['Compare Ofsted-rated nurseries near you'],
    })
    expect(res.status).toBe(200)
    expect(res.body.data.daily_budget).toBe(12.5)
    expect(res.body.data.status).toBe('paused')
  })

  it('GET /ads/campaigns maps the canonical status to the UI vocabulary', async () => {
    h.adsAvailable = false // skip live sync
    getTable('marketing_google_ads').push({
      id: 'camp-1',
      name: 'Live one',
      status: 'enabled',
      daily_budget: 5,
      spend: 2,
      created_at: new Date().toISOString(),
    })
    const res = await asAdmin(request(app).get('/api/v1/admin/marketing/ads/campaigns'))
    expect(res.status).toBe(200)
    expect(res.body.data[0].status).toBe('active')
  })

  it('PATCH /ads/campaigns/:id rejects an invalid status', async () => {
    const res = await asAdmin(
      request(app).patch('/api/v1/admin/marketing/ads/campaigns/camp-1')
    ).send({ status: 'enabled' })
    expect(res.status).toBe(400)
  })
})
