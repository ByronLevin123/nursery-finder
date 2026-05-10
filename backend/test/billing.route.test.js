process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

// ---------- tokens & users ----------
const AUTH_TOKEN = 'billing-auth-token'
const AUTH_USER = { id: 'user-billing-1', email: 'parent@example.com' }

// ---------- in-memory store ----------
const store = {
  user_profiles: [{ id: AUTH_USER.id, role: 'customer' }],
  tier_limits: [
    { tier: 'free', max_photos: 0, analytics: false },
    { tier: 'pro', max_photos: 10, analytics: true },
    { tier: 'premium', max_photos: 50, analytics: true },
  ],
}

function makeQueryBuilder(table) {
  const state = {
    table,
    op: 'select',
    filters: [],
  }

  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([col, op, val]) => {
        if (op === 'eq') return r[col] === val
        return true
      })
    )
  }

  const builder = {
    select() {
      return builder
    },
    insert(row) {
      state.op = 'insert'
      return builder
    },
    update(row) {
      state.op = 'update'
      return builder
    },
    eq(col, val) {
      state.filters.push([col, 'eq', val])
      return builder
    },
    order() {
      return builder
    },
    range() {
      return builder
    },
    limit() {
      return builder
    },
    single() {
      return builder._resolve(true, false)
    },
    maybeSingle() {
      return builder._resolve(true, true)
    },
    then(resolve, reject) {
      return builder._resolve(false, false).then(resolve, reject)
    },
    async _resolve(single, maybe) {
      if (state.op === 'insert' || state.op === 'update') {
        return { data: null, error: null }
      }
      const source = store[table] || []
      let rows = applyFilters(source)
      if (single) return { data: rows[0] ?? (maybe ? null : null), error: null }
      return { data: rows, error: null }
    },
  }
  return builder
}

// ---------- mocks ----------
vi.mock('../src/db.js', () => ({
  default: {
    from: (table) => makeQueryBuilder(table),
    rpc: vi.fn(async () => ({ data: [], error: null })),
  },
}))

vi.mock('@supabase/supabase-js', async () => ({
  createClient: () => ({
    auth: {
      getUser: async (token) => {
        if (token === AUTH_TOKEN) return { data: { user: AUTH_USER }, error: null }
        return { data: { user: null }, error: { message: 'invalid' } }
      },
    },
  }),
}))

const mockCreateCheckoutSession = vi.fn(async () => ({
  url: 'https://checkout.stripe.com/session-123',
}))
const mockCreatePortalSession = vi.fn(async () => ({
  url: 'https://billing.stripe.com/portal-123',
}))
const mockHandleWebhook = vi.fn(async () => ({ received: true }))
const mockGetProviderSubscription = vi.fn(async () => null)
const mockGetParentSubscription = vi.fn(async () => null)

vi.mock('../src/services/stripeService.js', () => ({
  createCheckoutSession: mockCreateCheckoutSession,
  createPortalSession: mockCreatePortalSession,
  handleWebhook: mockHandleWebhook,
  getProviderSubscription: mockGetProviderSubscription,
  getParentSubscription: mockGetParentSubscription,
}))

vi.mock('../src/services/geocoding.js', () => ({
  geocodePostcode: vi.fn(async () => ({ lat: 51.5, lng: -0.1 })),
  chunkPostcodes: (arr, n) => {
    const out = []
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
    return out
  },
}))

let app, request
let originalStripeKey

beforeAll(async () => {
  // Set STRIPE_SECRET_KEY so stripeGuard passes by default
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  app = (await import('../src/app.js')).default
  request = (await import('supertest')).default
})

beforeEach(() => {
  originalStripeKey = process.env.STRIPE_SECRET_KEY
})

afterEach(() => {
  process.env.STRIPE_SECRET_KEY = originalStripeKey
})

// ---------- GET /api/v1/billing/tiers ----------

describe('GET /api/v1/billing/tiers', () => {
  it('returns tier list (public, no auth needed)', async () => {
    const res = await request(app).get('/api/v1/billing/tiers')
    expect(res.status).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
    expect(res.body.data.length).toBe(3)
    expect(res.body.data.some((t) => t.tier === 'free')).toBe(true)
    expect(res.body.data.some((t) => t.tier === 'pro')).toBe(true)
    expect(res.body.data.some((t) => t.tier === 'premium')).toBe(true)
  })
})

// ---------- POST /api/v1/billing/checkout ----------

describe('POST /api/v1/billing/checkout', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .send({ tier: 'pro', type: 'provider' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when tier is missing', async () => {
    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${AUTH_TOKEN}`)
      .send({ type: 'provider' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when type is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${AUTH_TOKEN}`)
      .send({ tier: 'pro', type: 'invalid' })
    expect(res.status).toBe(400)
  })

  it('creates checkout session for authenticated user', async () => {
    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${AUTH_TOKEN}`)
      .send({ tier: 'pro', type: 'provider' })
    expect(res.status).toBe(200)
    expect(res.body.url).toContain('checkout.stripe.com')
    expect(mockCreateCheckoutSession).toHaveBeenCalled()
  })

  it('returns 503 when STRIPE_SECRET_KEY is not set', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${AUTH_TOKEN}`)
      .send({ tier: 'pro', type: 'provider' })
    expect(res.status).toBe(503)
    expect(res.body.error).toContain('Stripe not configured')
  })
})

// ---------- POST /api/v1/billing/webhook ----------

describe('POST /api/v1/billing/webhook', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await request(app)
      .post('/api/v1/billing/webhook')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'checkout.session.completed' }))
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('stripe-signature')
  })

  it('processes webhook with valid signature header', async () => {
    const res = await request(app)
      .post('/api/v1/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'test_sig_valid')
      .send(JSON.stringify({ type: 'checkout.session.completed' }))
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
    expect(mockHandleWebhook).toHaveBeenCalled()
  })

  it('returns 503 when STRIPE_SECRET_KEY is not set', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const res = await request(app)
      .post('/api/v1/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'test_sig')
      .send(JSON.stringify({ type: 'event' }))
    expect(res.status).toBe(503)
    expect(res.body.error).toContain('Stripe not configured')
  })
})

// ---------- GET /api/v1/billing/subscription ----------

describe('GET /api/v1/billing/subscription', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/billing/subscription')
    expect(res.status).toBe(401)
  })

  it('returns subscription info for authenticated user', async () => {
    mockGetParentSubscription.mockResolvedValueOnce({ tier: 'free', status: 'active' })
    const res = await request(app)
      .get('/api/v1/billing/subscription')
      .set('Authorization', `Bearer ${AUTH_TOKEN}`)
    expect(res.status).toBe(200)
    expect(res.body.type).toBe('parent')
    expect(res.body.subscription).toBeDefined()
  })
})

// ---------- POST /api/v1/billing/portal ----------

describe('POST /api/v1/billing/portal', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/billing/portal').send({})
    expect(res.status).toBe(401)
  })

  it('creates portal session for authenticated user', async () => {
    const res = await request(app)
      .post('/api/v1/billing/portal')
      .set('Authorization', `Bearer ${AUTH_TOKEN}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.url).toContain('billing.stripe.com')
  })
})
