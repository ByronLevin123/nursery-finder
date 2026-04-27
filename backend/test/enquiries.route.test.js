import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const USER = {
  id: 'user-1',
  email: 'user@example.com',
  // Required by requireVerifiedEmail middleware on the enquiry route. Set
  // to a fixed past timestamp so the user counts as verified in tests.
  email_confirmed_at: '2026-01-01T00:00:00Z',
}
const userToken = 'user-token'

const store = {
  enquiries: [],
  nurseries: new Map(),
}

function makeQueryBuilder(table) {
  const state = { table, op: 'select', filters: [], insertRow: null, selectCols: '' }
  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([c, op, v]) =>
        op === 'eq' ? r[c] === v : op === 'in' ? v.includes(r[c]) : true
      )
    )
  }
  const builder = {
    select(cols) {
      state.selectCols = cols || ''
      return builder
    },
    insert(row) {
      state.op = 'insert'
      state.insertRow = row
      return builder
    },
    update() {
      state.op = 'update'
      return builder
    },
    eq(c, v) {
      state.filters.push([c, 'eq', v])
      return builder
    },
    in(c, v) {
      state.filters.push([c, 'in', v])
      return builder
    },
    order() {
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
    then(onF, onR) {
      return builder._resolve(false, false).then(onF, onR)
    },
    async _resolve(single, maybe) {
      if (table === 'enquiries') {
        if (state.op === 'insert') {
          const row = {
            id: `e-${store.enquiries.length + 1}`,
            sent_at: new Date().toISOString(),
            ...state.insertRow,
          }
          store.enquiries.push(row)
          return single ? { data: row, error: null } : { data: [row], error: null }
        }
        const rows = applyFilters(store.enquiries).map((e) => {
          const n = [...store.nurseries.values()].find((n) => n.id === e.nursery_id)
          return { ...e, nurseries: n ? { name: n.name, urn: n.urn, town: n.town } : null }
        })
        if (single || maybe) return { data: rows[0] ?? null, error: null }
        return { data: rows, error: null }
      }
      if (table === 'nurseries') {
        const all = [...store.nurseries.values()]
        const rows = applyFilters(all)
        if (single || maybe) return { data: rows[0] ?? null, error: null }
        return { data: rows, error: null }
      }
      return { data: single ? null : [], error: null }
    },
  }
  return builder
}

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
        if (token === userToken) return { data: { user: USER }, error: null }
        return { data: { user: null }, error: { message: 'invalid' } }
      },
    },
  }),
}))

vi.mock('../src/services/geocoding.js', () => ({
  geocodePostcode: vi.fn(async () => ({ lat: 51.5, lng: -0.1 })),
  chunkPostcodes: (arr, n) => {
    const out = []
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
    return out
  },
}))

vi.mock('../src/services/emailService.js', () => ({
  sendEmail: vi.fn(async () => ({ messageId: 'test-123' })),
  isEmailAvailable: () => false,
  escapeHtml: (s) => String(s || ''),
  renderEnquiryNotificationEmail: vi.fn(() => ({
    subject: 'Test',
    html: '<p>Test</p>',
    text: 'Test',
  })),
  renderProviderInviteEmail: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>', text: 'Test' })),
  EmailNotConfiguredError: class extends Error {},
  EmailSendError: class extends Error {},
}))

vi.mock('../src/services/reviewNlp.js', () => ({
  extractCategoryScores: vi.fn(async () => null),
}))

let app
let request
beforeAll(async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_ANON_KEY = 'anon-test-key'
  app = (await import('../src/app.js')).default
  request = (await import('supertest')).default
})

beforeEach(() => {
  store.enquiries = []
  store.nurseries.clear()
  // Both nurseries are claimed by a provider — enquiries go through the
  // direct-send path rather than the admin-queued path. Tests that need the
  // queued path should override `claimed_by_user_id` to null in the test body.
  store.nurseries.set('n-1', {
    id: 'n-1',
    urn: 'EY100',
    name: 'Sunny',
    town: 'London',
    contact_email: null,
    email: null,
    claimed_by_user_id: 'provider-1',
  })
  store.nurseries.set('n-2', {
    id: 'n-2',
    urn: 'EY101',
    name: 'Bright',
    town: 'Leeds',
    contact_email: null,
    email: null,
    claimed_by_user_id: 'provider-2',
  })
})

describe('POST /api/v1/enquiries', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/v1/enquiries').send({})
    expect(res.status).toBe(401)
  })

  it('blocks users with unverified email (403, code email_not_verified)', async () => {
    // Temporarily clear email_confirmed_at on the test user.
    const original = USER.email_confirmed_at
    USER.email_confirmed_at = null
    try {
      const res = await request(app)
        .post('/api/v1/enquiries')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ nursery_ids: ['n-1'], child_name: 'Alice' })
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('email_not_verified')
    } finally {
      USER.email_confirmed_at = original
    }
  })

  it('creates enquiries for multiple nurseries', async () => {
    const res = await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        nursery_ids: ['n-1', 'n-2'],
        child_name: 'Alice',
        message: 'Interested in a place',
      })
    expect(res.status).toBe(201)
    expect(res.body.data.length).toBe(2)
    expect(res.body.meta.sent).toBe(2)
    expect(res.body.meta.queued).toBe(0)
  })

  it('queues enquiries for unclaimed nurseries instead of sending', async () => {
    // Override fixture: mark both as unclaimed so they go through the
    // admin-review / queued path.
    store.nurseries.get('n-1').claimed_by_user_id = null
    store.nurseries.get('n-2').claimed_by_user_id = null

    const res = await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        nursery_ids: ['n-1', 'n-2'],
        child_name: 'Alice',
        message: 'Interested in a place',
      })
    expect(res.status).toBe(201)
    expect(res.body.data.length).toBe(2)
    expect(res.body.meta.sent).toBe(0)
    expect(res.body.meta.queued).toBe(2)
    expect(res.body.data.every((e) => e.status === 'queued')).toBe(true)
  })

  it('rejects empty nursery_ids', async () => {
    const res = await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ nursery_ids: [] })
    expect(res.status).toBe(400)
  })

  it('rejects more than 10 nurseries', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `n-${i}`)
    const res = await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ nursery_ids: ids })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/v1/enquiries/mine', () => {
  it('returns empty list when no enquiries', async () => {
    const res = await request(app)
      .get('/api/v1/enquiries/mine')
      .set('Authorization', `Bearer ${userToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('returns enquiries after creation', async () => {
    await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ nursery_ids: ['n-1'], child_name: 'Bob' })

    const res = await request(app)
      .get('/api/v1/enquiries/mine')
      .set('Authorization', `Bearer ${userToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)
  })
})
