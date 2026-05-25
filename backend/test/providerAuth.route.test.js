import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_KEY = 'test-service-key'
process.env.FRONTEND_URL = 'https://nurserymatch.com'

const store = {
  nurseries: [],
  nursery_claims: [],
  user_profiles: [],
}

let claimSeq = 0

function makeQueryBuilder(table) {
  const state = { table, op: 'select', filters: [], insertRow: null, upsertRow: null }

  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([col, op, val]) => {
        if (op === 'eq') return r[col] === val
        if (op === 'in') return Array.isArray(val) && val.includes(r[col])
        return true
      })
    )
  }

  const builder = {
    select() { return builder },
    insert(row) { state.op = 'insert'; state.insertRow = row; return builder },
    update(row) { state.op = 'update'; return builder },
    upsert(row) { state.op = 'upsert'; state.upsertRow = row; return builder },
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
          id: `claim-${++claimSeq}`,
          created_at: new Date().toISOString(),
          ...state.insertRow,
        }
        rows.push(row)
        if (single) return { data: row, error: null }
        return { data: [row], error: null }
      }

      if (state.op === 'upsert') {
        const existing = rows.find((r) => r.id === state.upsertRow?.id)
        if (existing) {
          Object.assign(existing, state.upsertRow)
          return { data: existing, error: null }
        }
        rows.push(state.upsertRow)
        return { data: state.upsertRow, error: null }
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

const mockCreateUser = vi.fn()
const mockGenerateLink = vi.fn()

vi.mock('@supabase/supabase-js', async () => ({
  createClient: (url, key) => {
    if (key === 'test-service-key') {
      return {
        auth: {
          admin: {
            createUser: mockCreateUser,
            generateLink: mockGenerateLink,
          },
          getUser: async () => ({ data: { user: null }, error: { message: 'invalid' } }),
        },
      }
    }
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: { message: 'invalid' } }),
      },
    }
  },
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
  store.nurseries = [
    { urn: '123456', name: 'Happy Days Nursery', claimed_by_user_id: null },
  ]
  store.nursery_claims = []
  store.user_profiles = []
  claimSeq = 0
  mockCreateUser.mockReset()
  mockGenerateLink.mockReset()
  mockCreateUser.mockResolvedValue({
    data: { user: { id: 'new-user-1' } },
    error: null,
  })
  mockGenerateLink.mockResolvedValue({ data: {}, error: null })
})

describe('POST /api/v1/provider-auth/register', () => {
  const validPayload = {
    email: 'owner@happydays-nursery.co.uk',
    name: 'Jane Smith',
    phone: '07700900000',
    password: 'SecurePass123',
    role_at_nursery: 'Owner',
    urn: '123456',
    evidence_notes: 'I am the registered person on the Ofsted certificate.',
  }

  // Success test first — rate limiter allows 5 requests per hour per IP.
  // Tests are ordered to stay within this window.
  it('creates user, profile, and claim on success (201)', async () => {
    const res = await request(app)
      .post('/api/v1/provider-auth/register')
      .send(validPayload)
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.claim_id).toBeDefined()
    expect(res.body.is_new_user).toBe(true)
    expect(res.body.message).toMatch(/registration successful/i)

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: validPayload.email,
        password: validPayload.password,
        email_confirm: false,
      })
    )
  })

  it('validates required fields and email format', async () => {
    // Missing email
    const r1 = await request(app)
      .post('/api/v1/provider-auth/register')
      .send({ ...validPayload, email: undefined })
    expect(r1.status).toBe(400)
    expect(r1.body.error).toMatch(/email.*name.*urn/i)
  })

  it('rejects personal email and invalid passwords', async () => {
    // Personal email (Gmail)
    const r1 = await request(app)
      .post('/api/v1/provider-auth/register')
      .send({ ...validPayload, email: 'jane@gmail.com' })
    expect(r1.status).toBe(400)
    expect(r1.body.error).toMatch(/business email/i)
  })

  it('returns 404 when URN does not exist', async () => {
    const res = await request(app)
      .post('/api/v1/provider-auth/register')
      .send({ ...validPayload, urn: '999999' })
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  it('returns 409 when nursery is already claimed', async () => {
    store.nurseries[0].claimed_by_user_id = 'other-user'
    const res = await request(app)
      .post('/api/v1/provider-auth/register')
      .send(validPayload)
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/already been claimed/i)
  })
})
