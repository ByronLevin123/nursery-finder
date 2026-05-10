import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// Set env vars before any module imports
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

// In-memory store
const store = {
  nursery_availability: [],
  nurseries: [],
  nursery_claims: [],
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
    upsertRow: null,
    countMode: null,
  }

  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([col, op, val]) => {
        if (op === 'eq') return r[col] === val
        if (op === 'not_is') return r[col] !== val
        return true
      })
    )
  }

  const builder = {
    select(_cols, opts) {
      if (state.op === 'insert' || state.op === 'upsert') return builder
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
    upsert(rowOrRows) {
      state.op = 'upsert'
      state.upsertRow = rowOrRows
      return builder
    },
    eq(col, val) {
      state.filters.push([col, 'eq', val])
      return builder
    },
    not(col, op, val) {
      state.filters.push([col, 'not_is', val])
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
    order() {
      return builder
    },
    limit() {
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

      if (state.op === 'upsert') {
        const toUpsert = Array.isArray(state.upsertRow) ? state.upsertRow : [state.upsertRow]
        const upserted = toUpsert.map((r) => {
          const existing = rows.find(
            (e) => e.nursery_urn === r.nursery_urn && e.age_group === r.age_group
          )
          if (existing) {
            Object.assign(existing, r)
            return existing
          }
          const newRow = { id: `avail-${rows.length + 1}`, ...r }
          rows.push(newRow)
          return newRow
        })
        if (single) return { data: upserted[0], error: null }
        return { data: upserted, error: null }
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

      if (state.op === 'insert') {
        const toInsert = Array.isArray(state.insertRow) ? state.insertRow : [state.insertRow]
        const inserted = toInsert.map((r) => {
          const newRow = {
            id: `ins-${rows.length + 1}`,
            created_at: new Date().toISOString(),
            ...r,
          }
          rows.push(newRow)
          return newRow
        })
        if (single) return { data: inserted[0], error: null }
        return { data: inserted, error: null }
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

const TEST_USER = { id: 'user-avail-1', email: 'parent@example.com' }
const PROVIDER_USER = { id: 'user-provider-1', email: 'provider@example.com' }
const validToken = 'avail-valid-token'
const providerToken = 'avail-provider-token'

vi.mock('@supabase/supabase-js', async () => ({
  createClient: () => ({
    auth: {
      getUser: async (token) => {
        if (token === validToken) return { data: { user: TEST_USER }, error: null }
        if (token === providerToken) return { data: { user: PROVIDER_USER }, error: null }
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
  store.nursery_availability = []
  store.nurseries = []
  store.nursery_claims = []
  store.user_profiles = []
  store.provider_subscriptions = []
  store.tier_limits = []
})

const TEST_URN = 'EY600'

describe('GET /api/v1/nurseries/:urn/availability', () => {
  it('returns empty array when no availability data exists', async () => {
    const res = await request(app).get(`/api/v1/nurseries/${TEST_URN}/availability`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: [] })
  })

  it('returns availability data for a nursery (public, no auth needed)', async () => {
    store.nursery_availability.push(
      {
        id: 'a-1',
        nursery_urn: TEST_URN,
        age_group: 'Under 2',
        spots_available: 3,
        waitlist_length: 2,
        updated_at: new Date().toISOString(),
      },
      {
        id: 'a-2',
        nursery_urn: TEST_URN,
        age_group: '2-3 years',
        spots_available: 5,
        waitlist_length: 0,
        updated_at: new Date().toISOString(),
      }
    )

    const res = await request(app).get(`/api/v1/nurseries/${TEST_URN}/availability`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].nursery_urn).toBe(TEST_URN)
  })
})

describe('PUT /api/v1/provider/nurseries/:urn/availability', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put(`/api/v1/provider/nurseries/${TEST_URN}/availability`)
      .send([{ age_group: 'Under 2', spots_available: 3 }])
    expect(res.status).toBe(401)
  })

  it('returns 404 when nursery does not exist', async () => {
    const res = await request(app)
      .put(`/api/v1/provider/nurseries/${TEST_URN}/availability`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send([{ age_group: 'Under 2', spots_available: 3 }])
    expect(res.status).toBe(404)
  })

  it('returns 403 when user does not own the nursery', async () => {
    store.nurseries.push({
      urn: TEST_URN,
      name: 'Test Nursery',
      claimed_by_user_id: 'someone-else',
    })

    const res = await request(app)
      .put(`/api/v1/provider/nurseries/${TEST_URN}/availability`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send([{ age_group: 'Under 2', spots_available: 3 }])
    expect(res.status).toBe(403)
  })

  it('upserts availability when provider owns the nursery', async () => {
    store.nurseries.push({
      urn: TEST_URN,
      name: 'Test Nursery',
      claimed_by_user_id: PROVIDER_USER.id,
    })

    const res = await request(app)
      .put(`/api/v1/provider/nurseries/${TEST_URN}/availability`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send([
        { age_group: 'Under 2', spots_available: 3, waitlist_length: 1 },
        { age_group: '2-3 years', spots_available: 5, waitlist_length: 0 },
      ])
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
  })

  it('rejects invalid age_group', async () => {
    store.nurseries.push({
      urn: TEST_URN,
      name: 'Test Nursery',
      claimed_by_user_id: PROVIDER_USER.id,
    })

    const res = await request(app)
      .put(`/api/v1/provider/nurseries/${TEST_URN}/availability`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send([{ age_group: 'Invalid Group', spots_available: 3 }])
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Invalid age_group')
  })

  it('rejects non-array body', async () => {
    store.nurseries.push({
      urn: TEST_URN,
      name: 'Test Nursery',
      claimed_by_user_id: PROVIDER_USER.id,
    })

    const res = await request(app)
      .put(`/api/v1/provider/nurseries/${TEST_URN}/availability`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ age_group: 'Under 2', spots_available: 3 })
    expect(res.status).toBe(400)
  })
})
