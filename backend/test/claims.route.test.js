import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// Set env vars before any module imports
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

// In-memory store
const store = {
  nurseries: [],
  nursery_claims: [],
  user_profiles: [],
}

let claimSeq = 0

function makeQueryBuilder(table) {
  const state = {
    table,
    op: 'select',
    filters: [],
    insertRow: null,
    updateRow: null,
  }

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
    select(_cols) {
      // Don't reset op if chaining select after insert/update/upsert
      if (state.op !== 'insert' && state.op !== 'update' && state.op !== 'upsert') {
        state.op = 'select'
      }
      return builder
    },
    insert(row) {
      state.op = 'insert'
      state.insertRow = row
      return builder
    },
    update(row) {
      state.op = 'update'
      state.updateRow = row
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
    not() { return builder },
    is() { return builder },
    ilike() { return builder },
    like() { return builder },
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

      if (state.op === 'update') {
        const matching = applyFilters(rows)
        const updated = matching.map((r) => {
          const merged = { ...r, ...state.updateRow }
          const idx = rows.indexOf(r)
          if (idx >= 0) rows[idx] = merged
          return merged
        })
        if (single || maybe) {
          if (updated.length === 0 && !maybe) return { data: null, error: { message: 'Row not found' } }
          return { data: updated[0] ?? null, error: null }
        }
        return { data: updated, error: null }
      }

      // select
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
  default: {
    from: (table) => makeQueryBuilder(table),
    rpc: vi.fn(async () => ({ data: [], error: null })),
  },
}))

// email_confirmed_at populated for requireVerifiedEmail on POST /claims.
const TEST_USER = {
  id: 'user-claim-1',
  email: 'claimer@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
}
const ADMIN_USER = {
  id: 'admin-claim-1',
  email: 'admin@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
}
const validToken = 'claims-valid-token'
const adminToken = 'claims-admin-token'

vi.mock('@supabase/supabase-js', async () => ({
  createClient: () => ({
    auth: {
      getUser: async (token) => {
        if (token === validToken) return { data: { user: TEST_USER }, error: null }
        if (token === adminToken) return { data: { user: ADMIN_USER }, error: null }
        return { data: { user: null }, error: { message: 'invalid' } }
      },
    },
  }),
}))

// Mock email service (used by claim approve)
vi.mock('../src/services/emailService.js', () => ({
  isEmailAvailable: () => false,
  sendEmail: vi.fn(async () => {}),
  renderClaimApprovedEmail: vi.fn(() => ({ subject: 'Approved', html: '<p>ok</p>', text: 'ok' })),
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
  store.nurseries = []
  store.nursery_claims = []
  store.user_profiles = []
  claimSeq = 0
})

const TEST_URN = 'EY800'

const validClaimBody = {
  urn: TEST_URN,
  claimer_name: 'Jane Smith',
  claimer_email: 'jane@nursery.co.uk',
  claimer_role: 'Owner',
  evidence_notes: 'I am the registered owner with Ofsted.',
}

describe('POST /api/v1/claims — submit a claim', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/claims')
      .send(validClaimBody)
    expect(res.status).toBe(401)
  })

  it('returns 404 when nursery URN does not exist', async () => {
    const res = await request(app)
      .post('/api/v1/claims')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validClaimBody)
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('Nursery not found')
  })

  it('creates a claim with valid auth and existing nursery (201)', async () => {
    store.nurseries.push({ urn: TEST_URN, name: 'Test Nursery' })

    const res = await request(app)
      .post('/api/v1/claims')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validClaimBody)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      urn: TEST_URN,
      user_id: TEST_USER.id,
      claimer_name: 'Jane Smith',
      status: 'pending',
    })
  })

  it('rejects missing urn', async () => {
    const res = await request(app)
      .post('/api/v1/claims')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ claimer_name: 'Jane', claimer_email: 'jane@test.com' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('urn')
  })

  it('rejects missing claimer_name', async () => {
    const res = await request(app)
      .post('/api/v1/claims')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ urn: TEST_URN, claimer_email: 'jane@test.com' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('claimer_name')
  })

  it('rejects invalid claimer_role', async () => {
    const res = await request(app)
      .post('/api/v1/claims')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ ...validClaimBody, claimer_role: 'CEO' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('claimer_role')
  })
})

describe('POST /api/v1/claims/:id/approve — admin approves', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/claims/claim-1/approve')
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not admin', async () => {
    // validToken user has no admin role
    store.user_profiles.push({ id: TEST_USER.id, role: 'customer' })

    const res = await request(app)
      .post('/api/v1/claims/claim-1/approve')
      .set('Authorization', `Bearer ${validToken}`)
    expect(res.status).toBe(403)
  })

  it('approves a claim when admin authenticated', async () => {
    store.user_profiles.push({ id: ADMIN_USER.id, role: 'admin' })
    store.nurseries.push({ urn: TEST_URN, name: 'Test Nursery' })
    store.nursery_claims.push({
      id: 'claim-approve-1',
      urn: TEST_URN,
      user_id: TEST_USER.id,
      claimer_name: 'Jane Smith',
      claimer_email: 'jane@nursery.co.uk',
      status: 'pending',
      created_at: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/v1/claims/claim-approve-1/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ admin_notes: 'Verified via Ofsted register' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('approved')
    expect(res.body.admin_notes).toBe('Verified via Ofsted register')
  })

  it('returns 404 when claim does not exist', async () => {
    store.user_profiles.push({ id: ADMIN_USER.id, role: 'admin' })

    const res = await request(app)
      .post('/api/v1/claims/nonexistent/approve')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })
})

describe('POST /api/v1/claims/:id/reject — admin rejects', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/claims/claim-1/reject')
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not admin', async () => {
    store.user_profiles.push({ id: TEST_USER.id, role: 'customer' })

    const res = await request(app)
      .post('/api/v1/claims/claim-1/reject')
      .set('Authorization', `Bearer ${validToken}`)
    expect(res.status).toBe(403)
  })

  it('rejects a claim when admin authenticated', async () => {
    store.user_profiles.push({ id: ADMIN_USER.id, role: 'admin' })
    store.nursery_claims.push({
      id: 'claim-reject-1',
      urn: TEST_URN,
      user_id: TEST_USER.id,
      claimer_name: 'Jane Smith',
      claimer_email: 'jane@nursery.co.uk',
      status: 'pending',
      created_at: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/v1/claims/claim-reject-1/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ admin_notes: 'Could not verify ownership' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('rejected')
    expect(res.body.admin_notes).toBe('Could not verify ownership')
  })
})
