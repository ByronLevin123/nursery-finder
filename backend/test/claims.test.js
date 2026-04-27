import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// email_confirmed_at populated so requireVerifiedEmail middleware on
// POST /api/v1/claims doesn't 403 the test user.
const TEST_USER = {
  id: 'user-claims-1',
  email: 'claimer@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
}
const ADMIN_USER = {
  id: 'admin-1',
  email: 'admin@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
}

const store = {
  nurseries: new Map(),
  claims: new Map(),
}

let claimSeq = 0

function makeQueryBuilder(table) {
  const state = {
    table,
    op: 'select',
    filters: [],
    insertRow: null,
    updateRow: null,
    order: null,
  }

  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([col, op, val]) => (op === 'eq' ? r[col] === val : true))
    )
  }

  const builder = {
    select() {
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
    order() {
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
      // Handle user_profiles lookups for requireRole middleware
      if (table === 'user_profiles') {
        const idFilter = state.filters.find(([col]) => col === 'id')
        const userId = idFilter ? idFilter[2] : null
        const role = userId === ADMIN_USER.id ? 'admin' : 'customer'
        const row = { id: userId, role }
        return { data: single || maybe ? row : [row], error: null }
      }
      const target =
        table === 'nurseries' ? store.nurseries : table === 'nursery_claims' ? store.claims : null
      if (!target) {
        return { data: single ? null : [], error: null }
      }
      if (state.op === 'insert') {
        const row = { ...state.insertRow }
        if (table === 'nursery_claims') {
          row.id = row.id || `claim-${++claimSeq}`
          row.created_at = row.created_at || new Date().toISOString()
          store.claims.set(row.id, row)
        } else {
          target.set(row.urn, row)
        }
        return { data: single ? row : [row], error: null }
      }
      if (state.op === 'update') {
        const rows = applyFilters([...target.values()])
        const updated = rows.map((r) => {
          const merged = { ...r, ...state.updateRow }
          const key = table === 'nursery_claims' ? merged.id : merged.urn
          target.set(key, merged)
          return merged
        })
        if (single) return { data: updated[0] ?? null, error: null }
        return { data: updated, error: null }
      }
      const rows = applyFilters([...target.values()])
      if (single) return { data: rows[0] ?? null, error: null }
      return { data: rows, error: null }
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

const validToken = 'valid-token'
const adminToken = 'admin-token'
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
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_ANON_KEY = 'anon-test-key'
  process.env.ADMIN_USER = 'admin'
  process.env.ADMIN_PASS = 'secret'
  app = (await import('../src/app.js')).default
  request = (await import('supertest')).default
})

beforeEach(() => {
  store.nurseries.clear()
  store.claims.clear()
  claimSeq = 0
  store.nurseries.set('URN1', { urn: 'URN1', name: 'Sunny Nursery', town: 'London' })
})

const adminHeader = `Bearer ${adminToken}`

describe('POST /api/v1/claims', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/v1/claims').send({ urn: 'URN1' })
    expect(res.status).toBe(401)
  })

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/claims')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ urn: 'URN1' })
    expect(res.status).toBe(400)
  })

  it('rejects unknown URN', async () => {
    const res = await request(app)
      .post('/api/v1/claims')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        urn: 'NOPE',
        claimer_name: 'Jane',
        claimer_email: 'jane@example.com',
        claimer_role: 'Owner',
      })
    expect(res.status).toBe(404)
  })

  it('creates a pending claim', async () => {
    const res = await request(app)
      .post('/api/v1/claims')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        urn: 'URN1',
        claimer_name: 'Jane',
        claimer_email: 'jane@example.com',
        claimer_role: 'Owner',
        evidence_notes: 'I run it',
      })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')
    expect(res.body.urn).toBe('URN1')
    expect(res.body.user_id).toBe(TEST_USER.id)
  })
})

describe('GET /api/v1/claims/mine', () => {
  it('returns the user claims', async () => {
    store.claims.set('c1', {
      id: 'c1',
      urn: 'URN1',
      user_id: TEST_USER.id,
      claimer_name: 'Jane',
      claimer_email: 'jane@example.com',
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    const res = await request(app)
      .get('/api/v1/claims/mine')
      .set('Authorization', `Bearer ${validToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })
})

describe('admin approve / reject', () => {
  beforeEach(() => {
    store.claims.set('c1', {
      id: 'c1',
      urn: 'URN1',
      user_id: TEST_USER.id,
      claimer_name: 'Jane',
      claimer_email: 'jane@example.com',
      status: 'pending',
      created_at: new Date().toISOString(),
    })
  })

  it('rejects without admin auth', async () => {
    const res = await request(app).post('/api/v1/claims/c1/approve')
    expect(res.status).toBe(401)
  })

  it('approves a claim and marks the nursery claimed', async () => {
    const res = await request(app)
      .post('/api/v1/claims/c1/approve')
      .set('Authorization', adminHeader)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('approved')
    expect(store.nurseries.get('URN1').claimed_by_user_id).toBe(TEST_USER.id)
  })

  it('rejects a claim with admin notes', async () => {
    const res = await request(app)
      .post('/api/v1/claims/c1/reject')
      .set('Authorization', adminHeader)
      .send({ admin_notes: 'No evidence' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('rejected')
    expect(res.body.admin_notes).toBe('No evidence')
  })
})
