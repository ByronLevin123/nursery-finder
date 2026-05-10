process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'
process.env.ALERT_EMAIL = 'alerts@example.com'

import { describe, it, expect, vi, beforeAll } from 'vitest'

// ---------- tokens & users ----------
const ADMIN_TOKEN = 'admin-email-token'
const AUTH_TOKEN = 'auth-email-token'
const ADMIN_USER = { id: 'admin-email-1', email: 'admin@example.com' }
const AUTH_USER = { id: 'user-email-1', email: 'parent@example.com' }

// ---------- in-memory store ----------
const store = {
  user_profiles: [
    { id: ADMIN_USER.id, role: 'admin' },
    { id: AUTH_USER.id, role: 'customer' },
  ],
  nurseries: [
    {
      urn: 'EY100',
      name: 'Sunshine Nursery',
      ofsted_overall_grade: '1',
      town: 'London',
      postcode: 'SW1A 1AA',
    },
    {
      urn: 'EY101',
      name: 'Rainbow Nursery',
      ofsted_overall_grade: '2',
      town: 'Camden',
      postcode: 'NW1 1AA',
    },
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
        if (op === 'in') return val.includes(r[col])
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
    in(col, vals) {
      state.filters.push([col, 'in', vals])
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
        if (token === ADMIN_TOKEN) return { data: { user: ADMIN_USER }, error: null }
        if (token === AUTH_TOKEN) return { data: { user: AUTH_USER }, error: null }
        return { data: { user: null }, error: { message: 'invalid' } }
      },
    },
  }),
}))

let sendEmailMock
vi.mock('../src/services/emailService.js', () => {
  sendEmailMock = vi.fn(async () => ({ messageId: 'msg-test-123' }))
  return {
    sendEmail: sendEmailMock,
    renderShortlistEmail: vi.fn(() => ({
      subject: 'Your shortlist',
      html: '<p>Shortlist</p>',
      text: 'Shortlist',
    })),
    renderComparisonEmail: vi.fn(() => ({
      subject: 'Comparison',
      html: '<p>Comparison</p>',
      text: 'Comparison',
    })),
    isEmailAvailable: vi.fn(() => true),
    EmailNotConfiguredError: class EmailNotConfiguredError extends Error {},
  }
})

vi.mock('../src/services/geocoding.js', () => ({
  geocodePostcode: vi.fn(async () => ({ lat: 51.5, lng: -0.1 })),
  chunkPostcodes: (arr, n) => {
    const out = []
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
    return out
  },
}))

let app, request
beforeAll(async () => {
  app = (await import('../src/app.js')).default
  request = (await import('supertest')).default
})

const validShortlistBody = {
  to: 'parent@example.com',
  urns: ['EY100', 'EY101'],
}

// ---------- POST /api/v1/email/shortlist ----------
describe('POST /api/v1/email/shortlist', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/email/shortlist').send(validShortlistBody)
    expect(res.status).toBe(401)
  })

  it('returns 400 with invalid body (missing to)', async () => {
    const res = await request(app)
      .post('/api/v1/email/shortlist')
      .set('Authorization', `Bearer ${AUTH_TOKEN}`)
      .send({ urns: ['EY100'] })
    expect(res.status).toBe(400)
  })

  it('returns 400 with empty urns', async () => {
    const res = await request(app)
      .post('/api/v1/email/shortlist')
      .set('Authorization', `Bearer ${AUTH_TOKEN}`)
      .send({ to: 'test@example.com', urns: [] })
    expect(res.status).toBe(400)
  })

  it('sends shortlist email for authenticated user', async () => {
    const res = await request(app)
      .post('/api/v1/email/shortlist')
      .set('Authorization', `Bearer ${AUTH_TOKEN}`)
      .send(validShortlistBody)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.messageId).toBe('msg-test-123')
    expect(typeof res.body.count).toBe('number')
  })
})

// ---------- POST /api/v1/email/comparison ----------
describe('POST /api/v1/email/comparison', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/email/comparison').send(validShortlistBody)
    expect(res.status).toBe(401)
  })

  it('returns 400 with invalid body (missing urns)', async () => {
    const res = await request(app)
      .post('/api/v1/email/comparison')
      .set('Authorization', `Bearer ${AUTH_TOKEN}`)
      .send({ to: 'test@example.com' })
    expect(res.status).toBe(400)
  })

  it('sends comparison email for authenticated user', async () => {
    const res = await request(app)
      .post('/api/v1/email/comparison')
      .set('Authorization', `Bearer ${AUTH_TOKEN}`)
      .send(validShortlistBody)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.messageId).toBe('msg-test-123')
  })
})

// ---------- POST /api/v1/email/test (admin only) ----------
describe('POST /api/v1/email/test', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/email/test').send({})
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const res = await request(app)
      .post('/api/v1/email/test')
      .set('Authorization', `Bearer ${AUTH_TOKEN}`)
      .send({})
    expect(res.status).toBe(403)
  })

  it('sends test email for admin user', async () => {
    const res = await request(app)
      .post('/api/v1/email/test')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.messageId).toBe('msg-test-123')
  })

  it('sends test email to custom recipient', async () => {
    const res = await request(app)
      .post('/api/v1/email/test')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ to: 'custom@example.com' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
