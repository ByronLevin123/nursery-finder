import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// Set env vars before any module imports
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

// In-memory store
const store = {
  postcode_areas: [],
  property_listings: [],
  nurseries: [],
  user_profiles: [],
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
        if (op === 'gte') return r[col] >= val
        if (op === 'lte') return r[col] <= val
        if (op === 'like') {
          const pattern = '^' + val.replace(/%/g, '.*').replace(/_/g, '.') + '$'
          return new RegExp(pattern).test(r[col])
        }
        if (op === 'not_is') return r[col] !== val
        return true
      })
    )
  }

  const builder = {
    select(_cols, opts) {
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
    eq(col, val) {
      state.filters.push([col, 'eq', val])
      return builder
    },
    gte(col, val) {
      state.filters.push([col, 'gte', val])
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

      if (state.op === 'update') {
        return { data: null, error: null }
      }

      // select
      let result = applyFilters(rows)
      if (single || maybe) {
        if (result.length === 0 && !maybe)
          return { data: null, error: { message: 'Row not found' } }
        return { data: result[0] ?? null, error: null }
      }
      return { data: result, error: null, count: result.length }
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
      getUser: async () => ({ data: { user: null }, error: { message: 'invalid' } }),
    },
  }),
}))

// Mock propertyDataListings since properties.js imports it
vi.mock('../src/services/propertyDataListings.js', () => ({
  refreshDistrictListings: vi.fn(async () => ({
    fetched_at: new Date().toISOString(),
    cached: false,
  })),
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
  store.postcode_areas = []
  store.property_listings = []
  store.nurseries = []
  store.user_profiles = []
})

describe('GET /api/v1/properties/districts', () => {
  it('returns empty list when no district data exists', async () => {
    const res = await request(app).get('/api/v1/properties/districts')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta).toBeDefined()
  })

  it('returns district data with price and nursery info', async () => {
    store.postcode_areas.push(
      {
        postcode_district: 'SW1',
        local_authority: 'Westminster',
        region: 'London',
        avg_sale_price_all: 850000,
        avg_sale_price_flat: 600000,
        nursery_count_total: 25,
        nursery_count_outstanding: 5,
        nursery_outstanding_pct: 20,
        family_score: 78,
        lat: 51.5,
        lng: -0.13,
      },
      {
        postcode_district: 'E1',
        local_authority: 'Tower Hamlets',
        region: 'London',
        avg_sale_price_all: 550000,
        avg_sale_price_flat: 400000,
        nursery_count_total: 18,
        nursery_count_outstanding: 3,
        nursery_outstanding_pct: 16.7,
        family_score: 65,
        lat: 51.52,
        lng: -0.06,
      }
    )

    const res = await request(app).get('/api/v1/properties/districts')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].postcode_district).toBeDefined()
    expect(res.body.data[0].price_displayed).toBeDefined()
    expect(res.body.meta.price_column).toBe('avg_sale_price_all')
  })

  it('filters by max_price', async () => {
    store.postcode_areas.push(
      { postcode_district: 'SW1', avg_sale_price_all: 850000 },
      { postcode_district: 'E1', avg_sale_price_all: 550000 }
    )

    const res = await request(app).get('/api/v1/properties/districts?max_price=600000')
    expect(res.status).toBe(200)
    // Only E1 should pass the max_price filter
    expect(res.body.data.every((d) => d.avg_sale_price_all <= 600000)).toBe(true)
  })

  it('uses correct price column for property_type=flat', async () => {
    store.postcode_areas.push({
      postcode_district: 'SW1',
      avg_sale_price_all: 850000,
      avg_sale_price_flat: 600000,
    })

    const res = await request(app).get('/api/v1/properties/districts?property_type=flat')
    expect(res.status).toBe(200)
    expect(res.body.meta.price_column).toBe('avg_sale_price_flat')
  })
})

describe('GET /api/v1/properties/search', () => {
  it('requires district query parameter', async () => {
    const res = await request(app).get('/api/v1/properties/search')
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('district')
  })

  it('returns listings for a valid district', async () => {
    store.property_listings.push(
      {
        id: 'pl-1',
        postcode_district: 'SW1',
        listing_type: 'sale',
        price: 500000,
        bedrooms: 2,
        property_type: 'flat',
      },
      {
        id: 'pl-2',
        postcode_district: 'SW1',
        listing_type: 'sale',
        price: 750000,
        bedrooms: 3,
        property_type: 'terraced',
      }
    )

    const res = await request(app).get('/api/v1/properties/search?district=SW1')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.meta.district).toBe('SW1')
    expect(res.body.meta.listing_type).toBe('sale')
    // Each listing should have nursery_overlay
    expect(res.body.data[0].nursery_overlay).toBeDefined()
  })
})
