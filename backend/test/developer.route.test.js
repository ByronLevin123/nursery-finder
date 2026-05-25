import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

const store = {
  developer_accounts: [],
  developer_api_keys: [],
  user_profiles: [],
}

let seq = 0

function makeQueryBuilder(table) {
  const state = { table, op: 'select', filters: [], insertRow: null }

  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([col, op, val]) => {
        if (op === 'eq') return r[col] === val
        return true
      })
    )
  }

  const builder = {
    select() { return builder },
    insert(row) { state.op = 'insert'; state.insertRow = row; return builder },
    update(row) { state.op = 'update'; return builder },
    upsert(row) { state.op = 'upsert'; return builder },
    eq(col, val) { state.filters.push([col, 'eq', val]); return builder },
    in(col, vals) { state.filters.push([col, 'in', vals]); return builder },
    neq() { return builder },
    not() { return builder },
    is() { return builder },
    ilike() { return builder },
    gte() { return builder },
    lte() { return builder },
    order() { return builder },
    limit() { return builder },
    single() { return builder._resolve(true, false) },
    maybeSingle() { return builder._resolve(true, true) },
    then(onFulfilled, onRejected) {
      return builder._resolve(false, false).then(onFulfilled, onRejected)
    },
    async _resolve(single, maybe) {
      const rows = store[state.table] || []

      if (state.op === 'insert') {
        const row = {
          id: `dev-${++seq}`,
          created_at: new Date().toISOString(),
          tier: 'free',
          status: 'active',
          ...state.insertRow,
        }
        rows.push(row)
        if (single) return { data: row, error: null }
        return { data: [row], error: null }
      }

      let result = applyFilters(rows)
      if (single || maybe) {
        if (result.length === 0 && !maybe) return { data: null, error: { message: 'Row not found' } }
        return { data: result[0] ?? null, error: null }
      }
      return { data: result, error: null }
    },
  }
  return builder
}

vi.mock('../src/db.js', () => ({
  default: { from: (table) => makeQueryBuilder(table) },
}))

const DEV_USER = {
  id: 'user-dev-1',
  email: 'dev@company.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
}

const validToken = 'dev-valid-token'

vi.mock('@supabase/supabase-js', async () => ({
  createClient: () => ({
    auth: {
      getUser: async (token) => {
        if (token === validToken) return { data: { user: DEV_USER }, error: null }
        return { data: { user: null }, error: { message: 'invalid' } }
      },
    },
  }),
}))

vi.mock('../src/services/emailService.js', () => ({
  isEmailAvailable: () => false,
  sendEmail: vi.fn(async () => {}),
  renderClaimApprovedEmail: vi.fn(() => ({ subject: 's', html: '<p/>', text: 't' })),
}))

vi.mock('../src/services/reviewNlp.js', () => ({
  extractCategoryScores: vi.fn(async () => null),
}))

vi.mock('../src/services/geocoding.js', () => ({
  geocodePostcode: vi.fn(async () => ({ lat: 51.5, lng: -0.1 })),
  chunkPostcodes: (arr, n) => {
    const out = []
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
    return out
  },
}))

let app
let request
beforeAll(async () => {
  app = (await import('../src/app.js')).default
  request = (await import('supertest')).default
})

beforeEach(() => {
  store.developer_accounts = []
  store.developer_api_keys = []
  store.user_profiles = [{ id: DEV_USER.id, email: DEV_USER.email, role: 'customer' }]
  seq = 0
})

describe('POST /api/v1/developer/register', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/developer/register')
      .send({ company_name: 'TestCo' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when company_name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/developer/register')
      .set('Authorization', `Bearer ${validToken}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/company_name/i)
  })

  it('returns 400 when company_name is too short', async () => {
    const res = await request(app)
      .post('/api/v1/developer/register')
      .set('Authorization', `Bearer ${validToken}`)
      .set('Content-Type', 'application/json')
      .send({ company_name: 'A' })
    expect(res.status).toBe(400)
  })

  it('creates developer account and returns API key on success', async () => {
    const res = await request(app)
      .post('/api/v1/developer/register')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ company_name: 'TestCo Ltd', website_url: 'https://testco.com', use_case: 'Property portal' })
    expect(res.status).toBe(201)
    expect(res.body.account).toBeDefined()
    expect(res.body.account.company_name).toBe('TestCo Ltd')
    expect(res.body.account.tier).toBe('free')
    expect(res.body.api_key).toMatch(/^nm_live_/)
    expect(res.body.note).toMatch(/save/i)
  })

  it('returns 409 when developer account already exists', async () => {
    store.developer_accounts.push({
      id: 'existing-dev',
      user_id: DEV_USER.id,
      company_name: 'Existing Co',
      tier: 'free',
      status: 'active',
    })

    const res = await request(app)
      .post('/api/v1/developer/register')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ company_name: 'Another Co' })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/already exists/i)
  })
})
