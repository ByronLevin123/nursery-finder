process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

import { describe, it, expect, vi, beforeAll } from 'vitest'

// ---------- tokens & users ----------
const ADMIN_TOKEN = 'admin-areas-token'
const USER_TOKEN = 'user-areas-token'
const ADMIN_USER = { id: 'admin-areas-1', email: 'admin@example.com' }
const REGULAR_USER = { id: 'user-areas-1', email: 'user@example.com' }

// ---------- in-memory store ----------
const store = {
  user_profiles: [
    { id: ADMIN_USER.id, role: 'admin' },
    { id: REGULAR_USER.id, role: 'customer' },
  ],
  postcode_areas: [
    {
      postcode_district: 'NW1',
      local_authority: 'Camden',
      region: 'London',
      nursery_count_total: 25,
      nursery_count_outstanding: 5,
      nursery_count_good: 15,
      nursery_outstanding_pct: 20,
      avg_sale_price_all: 650000,
      crime_rate_per_1000: 85,
      imd_decile: 6,
      flood_risk_level: 'low',
      family_score: 78,
      family_score_breakdown: {},
      lat: 51.534,
      lng: -0.139,
      updated_at: '2024-06-01',
    },
    {
      postcode_district: 'SW1A',
      local_authority: 'Westminster',
      region: 'London',
      nursery_count_total: 10,
      nursery_count_outstanding: 3,
      nursery_count_good: 5,
      nursery_outstanding_pct: 30,
      avg_sale_price_all: 1200000,
      crime_rate_per_1000: 120,
      imd_decile: 8,
      flood_risk_level: 'medium',
      family_score: 65,
      family_score_breakdown: {},
      lat: 51.501,
      lng: -0.141,
      updated_at: '2024-06-01',
    },
  ],
  nurseries: [
    {
      urn: 'EY100',
      name: 'Sunshine Nursery',
      registration_status: 'Active',
      ofsted_overall_grade: 'Outstanding',
      postcode: 'NW1 1AA',
      town: 'Camden',
      local_authority: 'Camden',
    },
    {
      urn: 'EY101',
      name: 'Rainbow Nursery',
      registration_status: 'Active',
      ofsted_overall_grade: 'Good',
      postcode: 'NW1 2BB',
      town: 'Camden',
      local_authority: 'Camden',
    },
    {
      urn: 'EY102',
      name: 'Star Nursery',
      registration_status: 'Active',
      ofsted_overall_grade: 'Good',
      postcode: 'SW1A 1CC',
      town: 'Westminster',
      local_authority: 'Westminster',
    },
  ],
}

function makeQueryBuilder(table) {
  const state = {
    table,
    op: 'select',
    filters: [],
    limitN: null,
  }

  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([col, op, val]) => {
        if (op === 'eq') return r[col] === val
        if (op === 'gte') return r[col] >= val
        if (op === 'gt') return r[col] > val
        if (op === 'lte') return r[col] <= val
        if (op === 'like') {
          const regex = new RegExp('^' + val.replace(/%/g, '.*').replace(/_/g, '.') + '$')
          return regex.test(r[col])
        }
        if (op === 'not_is') return r[col] != null
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
    delete() {
      state.op = 'delete'
      return builder
    },
    eq(col, val) {
      state.filters.push([col, 'eq', val])
      return builder
    },
    gte(col, val) {
      state.filters.push([col, 'gte', val])
      return builder
    },
    gt(col, val) {
      state.filters.push([col, 'gt', val])
      return builder
    },
    lte(col, val) {
      state.filters.push([col, 'lte', val])
      return builder
    },
    like(col, val) {
      state.filters.push([col, 'like', val])
      return builder
    },
    not(col, _is, _null) {
      state.filters.push([col, 'not_is', null])
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
    limit(n) {
      state.limitN = n
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
      if (state.op === 'insert' || state.op === 'update' || state.op === 'delete') {
        return { data: null, error: null }
      }
      const source = store[table] || []
      let rows = applyFilters(source)
      if (state.limitN != null) rows = rows.slice(0, state.limitN)
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
        if (token === USER_TOKEN) return { data: { user: REGULAR_USER }, error: null }
        return { data: { user: null }, error: { message: 'invalid' } }
      },
    },
  }),
}))

vi.mock('../src/services/propertyData.js', () => ({
  refreshDistrictPropertyData: vi.fn(async (district) => ({
    district,
    refreshed: true,
    asking_price_avg: 500000,
  })),
}))

vi.mock('../src/services/geocoding.js', () => ({
  geocodePostcode: vi.fn(async () => ({ lat: 51.534, lng: -0.139 })),
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

// ---------- GET /api/v1/areas/:district ----------

describe('GET /api/v1/areas/:district', () => {
  it('returns area data for a known district', async () => {
    const res = await request(app).get('/api/v1/areas/NW1')
    expect(res.status).toBe(200)
    expect(res.body.postcode_district).toBe('NW1')
    expect(res.body.local_authority).toBe('Camden')
    expect(res.body.nursery_count_total).toBe(25)
  })

  it('returns area data case-insensitively (lowercase input)', async () => {
    const res = await request(app).get('/api/v1/areas/nw1')
    expect(res.status).toBe(200)
    expect(res.body.postcode_district).toBe('NW1')
  })

  it('returns 404 for an unknown district', async () => {
    const res = await request(app).get('/api/v1/areas/ZZ99')
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('not found')
  })
})

// ---------- GET /api/v1/areas/:district/nurseries ----------

describe('GET /api/v1/areas/:district/nurseries', () => {
  it('returns nurseries in a known district', async () => {
    const res = await request(app).get('/api/v1/areas/NW1/nurseries')
    expect(res.status).toBe(200)
    expect(res.body.nurseries).toBeInstanceOf(Array)
    expect(res.body.nurseries.length).toBeGreaterThanOrEqual(1)
    expect(res.body.stats).toBeDefined()
    expect(res.body.stats.district).toBe('NW1')
  })

  it('returns empty array for a district with no nurseries', async () => {
    const res = await request(app).get('/api/v1/areas/ZZ99/nurseries')
    expect(res.status).toBe(200)
    expect(res.body.nurseries).toEqual([])
    expect(res.body.stats.total).toBe(0)
  })
})

// ---------- POST /api/v1/areas/:district/refresh-property-data ----------

describe('POST /api/v1/areas/:district/refresh-property-data', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/areas/NW1/refresh-property-data').send({})
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const res = await request(app)
      .post('/api/v1/areas/NW1/refresh-property-data')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send({})
    expect(res.status).toBe(403)
  })

  it('succeeds for admin user', async () => {
    const res = await request(app)
      .post('/api/v1/areas/NW1/refresh-property-data')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.district).toBe('NW1')
    expect(res.body.refreshed).toBe(true)
  })
})

// ---------- GET /api/v1/areas/family-search ----------

describe('GET /api/v1/areas/family-search', () => {
  it('returns 400 when postcode is missing', async () => {
    const res = await request(app).get('/api/v1/areas/family-search')
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('postcode')
  })

  it('returns area results for a valid postcode', async () => {
    const res = await request(app)
      .get('/api/v1/areas/family-search')
      .query({ postcode: 'NW1 1AA', radius_km: 50 })
    expect(res.status).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
    expect(res.body.meta).toBeDefined()
    expect(res.body.meta.search_lat).toBeDefined()
    expect(res.body.meta.search_lng).toBeDefined()
  })
})
