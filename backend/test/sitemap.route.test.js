process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

import { describe, it, expect, vi, beforeAll } from 'vitest'

// ---------- in-memory store ----------
const store = {
  user_profiles: [],
  nurseries: [
    { urn: 'EY100', name: 'Sunshine Nursery', registration_status: 'Active', town: 'Camden', location: true },
    { urn: 'EY101', name: 'Rainbow Nursery', registration_status: 'Active', town: 'Camden', location: true },
    { urn: 'EY102', name: 'Star Nursery', registration_status: 'Active', town: 'Islington', location: true },
    { urn: 'EY103', name: 'Closed Nursery', registration_status: 'Inactive', town: 'Camden', location: true },
  ],
  postcode_areas: [
    { postcode_district: 'NW1', nursery_count_total: 25 },
    { postcode_district: 'SW1A', nursery_count_total: 10 },
    { postcode_district: 'ZZ99', nursery_count_total: 0 },
  ],
}

function makeQueryBuilder(table) {
  const state = {
    table,
    op: 'select',
    filters: [],
    rangeFrom: null,
    rangeTo: null,
  }

  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([col, op, val]) => {
        if (op === 'eq') return r[col] === val
        if (op === 'gt') return r[col] > val
        if (op === 'not_is') return r[col] != null
        return true
      })
    )
  }

  const builder = {
    select() { return builder },
    eq(col, val) { state.filters.push([col, 'eq', val]); return builder },
    gt(col, val) { state.filters.push([col, 'gt', val]); return builder },
    not(col, _is, _null) { state.filters.push([col, 'not_is', null]); return builder },
    order() { return builder },
    range(from, to) { state.rangeFrom = from; state.rangeTo = to; return builder },
    limit() { return builder },
    single() { return builder._resolve(true, false) },
    maybeSingle() { return builder._resolve(true, true) },
    then(resolve, reject) { return builder._resolve(false, false).then(resolve, reject) },
    async _resolve(single, maybe) {
      const source = store[table] || []
      let rows = applyFilters(source)
      if (state.rangeFrom != null) {
        rows = rows.slice(state.rangeFrom, (state.rangeTo ?? rows.length - 1) + 1)
      }
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
      getUser: async () => ({ data: { user: null }, error: { message: 'invalid' } }),
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

let app, request
beforeAll(async () => {
  app = (await import('../src/app.js')).default
  request = (await import('supertest')).default
})

// ---------- GET /api/v1/sitemap/nurseries ----------

describe('GET /api/v1/sitemap/nurseries', () => {
  it('returns a list of active nursery URNs', async () => {
    const res = await request(app).get('/api/v1/sitemap/nurseries')
    expect(res.status).toBe(200)
    expect(res.body.urns).toBeInstanceOf(Array)
    // Should only include Active nurseries
    expect(res.body.urns).toContain('EY100')
    expect(res.body.urns).toContain('EY101')
    expect(res.body.urns).toContain('EY102')
    // Should NOT include inactive nursery
    expect(res.body.urns).not.toContain('EY103')
  })

  it('returns count matching the number of URNs', async () => {
    const res = await request(app).get('/api/v1/sitemap/nurseries')
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(res.body.urns.length)
  })

  it('sets cache-control header', async () => {
    const res = await request(app).get('/api/v1/sitemap/nurseries')
    expect(res.status).toBe(200)
    const cacheControl = res.headers['cache-control']
    expect(cacheControl).toBeDefined()
    expect(cacheControl).toContain('public')
  })
})

// ---------- GET /api/v1/sitemap/districts ----------

describe('GET /api/v1/sitemap/districts', () => {
  it('returns districts with nursery_count_total > 0', async () => {
    const res = await request(app).get('/api/v1/sitemap/districts')
    expect(res.status).toBe(200)
    expect(res.body.districts).toBeInstanceOf(Array)
    expect(res.body.districts).toContain('NW1')
    expect(res.body.districts).toContain('SW1A')
    // ZZ99 has nursery_count_total = 0, should be excluded
    expect(res.body.districts).not.toContain('ZZ99')
  })

  it('returns count matching the number of districts', async () => {
    const res = await request(app).get('/api/v1/sitemap/districts')
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(res.body.districts.length)
  })
})

// ---------- GET /api/v1/sitemap/towns ----------

describe('GET /api/v1/sitemap/towns', () => {
  it('returns unique town names', async () => {
    const res = await request(app).get('/api/v1/sitemap/towns')
    expect(res.status).toBe(200)
    expect(res.body.towns).toBeInstanceOf(Array)
    expect(res.body.towns.length).toBeGreaterThanOrEqual(1)
  })

  it('returns count matching the number of towns', async () => {
    const res = await request(app).get('/api/v1/sitemap/towns')
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(res.body.towns.length)
  })
})

// ---------- GET /api/v1/sitemap/blog ----------

describe('GET /api/v1/sitemap/blog', () => {
  it('returns an array of slugs (empty if no blog dir)', async () => {
    const res = await request(app).get('/api/v1/sitemap/blog')
    expect(res.status).toBe(200)
    expect(res.body.slugs).toBeInstanceOf(Array)
    expect(typeof res.body.count).toBe('number')
  })
})
