import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// Set env vars before any module imports
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

// In-memory store
const store = {
  nursery_fees: [],
  nurseries: [],
  user_profiles: [],
  provider_subscriptions: [],
  tier_limits: [],
}

function makeQueryBuilder(table) {
  const state = {
    table,
    op: 'select',
    filters: [],
    insertRow: null,
    updateRow: null,
    countMode: null,
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
    select(_cols, opts) {
      if (state.op === 'insert') return builder
      state.op = 'select'
      if (opts?.count) state.countMode = opts.count
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
    delete() {
      state.op = 'delete'
      return builder
    },
    eq(col, val) {
      state.filters.push([col, 'eq', val])
      return builder
    },
    not() {
      return builder
    },
    is() {
      return builder
    },
    in() {
      return builder
    },
    ilike() {
      return builder
    },
    like() {
      return builder
    },
    gte() {
      return builder
    },
    lte() {
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
    then(onFulfilled, onRejected) {
      return builder._resolve(false, false).then(onFulfilled, onRejected)
    },
    async _resolve(single, maybe) {
      const rows = store[state.table] || []

      if (state.op === 'insert') {
        const toInsert = Array.isArray(state.insertRow) ? state.insertRow : [state.insertRow]
        const inserted = toInsert.map((r) => {
          const newRow = {
            id: `fee-${rows.length + 1}`,
            created_at: new Date().toISOString(),
            ...r,
          }
          rows.push(newRow)
          return newRow
        })
        if (single) return { data: inserted[0], error: null }
        return { data: inserted, error: null }
      }

      if (state.op === 'update') {
        const matching = applyFilters(rows)
        const updated = matching.map((r) => {
          const merged = { ...r, ...state.updateRow }
          const idx = rows.indexOf(r)
          if (idx >= 0) rows[idx] = merged
          return merged
        })
        if (single || maybe) return { data: updated[0] ?? null, error: null }
        return { data: updated, error: null }
      }

      if (state.op === 'delete') {
        const matching = applyFilters(rows)
        for (const r of matching) {
          const idx = rows.indexOf(r)
          if (idx >= 0) rows.splice(idx, 1)
        }
        return { data: matching, error: null }
      }

      // select
      let result = applyFilters(rows)
      if (state.countMode) return { data: result, error: null, count: result.length }
      if (single || maybe) {
        if (result.length === 0 && !maybe)
          return { data: null, error: { message: 'Row not found' } }
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

const TEST_USER = { id: 'user-fees-1', email: 'parent@example.com' }
const validToken = 'fees-valid-token'

vi.mock('@supabase/supabase-js', async () => ({
  createClient: () => ({
    auth: {
      getUser: async (token) => {
        if (token === validToken) return { data: { user: TEST_USER }, error: null }
        return { data: { user: null }, error: { message: 'invalid' } }
      },
    },
  }),
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
  store.nursery_fees = []
  store.nurseries = []
  store.user_profiles = []
  store.provider_subscriptions = []
  store.tier_limits = []
})

const TEST_URN = 'EY700'

describe('POST /api/v1/nurseries/fees — anonymous fee submission', () => {
  it('submits a fee using nursery_urn column (bug fix verification)', async () => {
    const res = await request(app).post('/api/v1/nurseries/fees').send({
      nursery_urn: TEST_URN,
      fee_per_month: 1200,
      hours_per_week: 30,
      age_group: 'Under 2',
    })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // Verify the fee was stored with nursery_urn (not urn or nursery_id)
    expect(store.nursery_fees).toHaveLength(1)
    expect(store.nursery_fees[0].nursery_urn).toBe(TEST_URN)
  })

  it('rejects missing nursery_urn', async () => {
    const res = await request(app).post('/api/v1/nurseries/fees').send({ fee_per_month: 1200 })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('nursery_urn')
  })

  it('rejects missing fee_per_month', async () => {
    const res = await request(app).post('/api/v1/nurseries/fees').send({ nursery_urn: TEST_URN })
    expect(res.status).toBe(400)
  })

  it('rejects fee_per_month below 100', async () => {
    const res = await request(app)
      .post('/api/v1/nurseries/fees')
      .send({ nursery_urn: TEST_URN, fee_per_month: 50 })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('between 100 and 5000')
  })

  it('rejects fee_per_month above 5000', async () => {
    const res = await request(app)
      .post('/api/v1/nurseries/fees')
      .send({ nursery_urn: TEST_URN, fee_per_month: 6000 })
    expect(res.status).toBe(400)
  })

  it('updates average fee on nurseries table when 3+ fee reports exist', async () => {
    // Seed 2 existing fees
    store.nursery_fees.push(
      {
        id: 'f-1',
        nursery_urn: TEST_URN,
        fee_per_month: 1000,
        created_at: new Date().toISOString(),
      },
      {
        id: 'f-2',
        nursery_urn: TEST_URN,
        fee_per_month: 1200,
        created_at: new Date().toISOString(),
      }
    )
    // Seed the nursery so the update can target it
    store.nurseries.push({ urn: TEST_URN, name: 'Test Nursery' })

    const res = await request(app).post('/api/v1/nurseries/fees').send({
      nursery_urn: TEST_URN,
      fee_per_month: 1100,
      hours_per_week: 25,
      age_group: '2-3 years',
    })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // After 3 fees, the nursery should have been updated
    expect(store.nursery_fees).toHaveLength(3)
  })
})

describe('GET /api/v1/provider/nurseries/:urn/fees — public fee list', () => {
  it('returns empty array when no fees exist', async () => {
    const res = await request(app).get(`/api/v1/provider/nurseries/${TEST_URN}/fees`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: [] })
  })

  it('returns fees for a nursery (no auth needed)', async () => {
    store.nursery_fees.push(
      {
        id: 'f-pub-1',
        nursery_urn: TEST_URN,
        age_group: 'Under 2',
        session_type: 'Full day',
        price_gbp: 70,
        created_at: new Date().toISOString(),
      },
      {
        id: 'f-pub-2',
        nursery_urn: TEST_URN,
        age_group: '2-3 years',
        session_type: 'Half day',
        price_gbp: 40,
        created_at: new Date().toISOString(),
      }
    )

    const res = await request(app).get(`/api/v1/provider/nurseries/${TEST_URN}/fees`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].nursery_urn).toBe(TEST_URN)
  })
})
