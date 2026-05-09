process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

import { describe, it, expect, vi, beforeAll } from 'vitest'

// ---------- tokens & users ----------
const ADMIN_TOKEN = 'admin-overlay-token'
const USER_TOKEN = 'user-overlay-token'
const ADMIN_USER = { id: 'admin-overlay-1', email: 'admin@example.com' }
const REGULAR_USER = { id: 'user-overlay-1', email: 'user@example.com' }

// ---------- in-memory store ----------
const store = {
  user_profiles: [
    { id: ADMIN_USER.id, role: 'admin' },
    { id: REGULAR_USER.id, role: 'customer' },
  ],
  schools: [
    {
      urn: 'S100',
      name: 'Test Primary',
      phase: 'Primary',
      postcode: 'SW1A 1AA',
      lat: 51.501,
      lng: -0.1415,
      ofsted_grade: '1',
      last_inspection_date: '2024-01-10',
    },
    {
      urn: 'S101',
      name: 'Test Secondary',
      phase: 'Secondary',
      postcode: 'SW1A 1AB',
      lat: 51.502,
      lng: -0.1420,
      ofsted_grade: '2',
      last_inspection_date: '2023-06-15',
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
        if (op === 'lte') return r[col] <= val
        if (op === 'not_is') return r[col] != null
        if (op === 'in') return val.includes(r[col])
        return true
      })
    )
  }

  const builder = {
    select() { return builder },
    insert(row) { state.op = 'insert'; state.insertRow = row; return builder },
    update(row) { state.op = 'update'; state.updateRow = row; return builder },
    delete() { state.op = 'delete'; return builder },
    eq(col, val) { state.filters.push([col, 'eq', val]); return builder },
    gte(col, val) { state.filters.push([col, 'gte', val]); return builder },
    lte(col, val) { state.filters.push([col, 'lte', val]); return builder },
    not(col, _is, _null) { state.filters.push([col, 'not_is', null]); return builder },
    in(col, vals) { state.filters.push([col, 'in', vals]); return builder },
    order() { return builder },
    range() { return builder },
    limit(n) { state.limitN = n; return builder },
    single() { return builder._resolve(true, false) },
    maybeSingle() { return builder._resolve(true, true) },
    then(resolve, reject) { return builder._resolve(false, false).then(resolve, reject) },
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

// Mock overlay service modules so the routes don't make real HTTP calls
vi.mock('../src/services/floodRisk.js', () => ({
  refreshAllFloodRisk: vi.fn(async () => ({ refreshed: 10 })),
  refreshFloodRiskForDistrict: vi.fn(async (d) => ({ district: d, refreshed: 3 })),
}))

vi.mock('../src/services/parksData.js', () => ({
  refreshAllParks: vi.fn(async () => ({ refreshed: 5 })),
  refreshParksForDistrict: vi.fn(async (d) => ({ district: d, refreshed: 2 })),
}))

vi.mock('../src/services/schoolsIngest.js', () => ({
  ingestSchoolsFromCsvUrl: vi.fn(async () => ({ inserted: 100, updated: 20 })),
  geocodeSchoolsBatch: vi.fn(async (limit) => ({ geocoded: limit })),
}))

vi.mock('../src/services/geocoding.js', () => ({
  geocodePostcode: vi.fn(async () => ({ lat: 51.501, lng: -0.1415 })),
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

// ---------- tests ----------

describe('Overlay routes — auth checks', () => {
  const adminPostRoutes = [
    '/api/v1/overlays/flood/refresh-all',
    '/api/v1/overlays/flood/testdistrict/refresh',
    '/api/v1/overlays/parks/refresh-all',
    '/api/v1/overlays/parks/testdistrict/refresh',
    '/api/v1/overlays/schools/ingest',
    '/api/v1/overlays/schools/geocode',
  ]

  for (const path of adminPostRoutes) {
    it(`POST ${path} returns 401 without auth`, async () => {
      const res = await request(app).post(path).send({})
      expect(res.status).toBe(401)
    })

    it(`POST ${path} returns 403 for non-admin user`, async () => {
      const res = await request(app)
        .post(path)
        .set('Authorization', `Bearer ${USER_TOKEN}`)
        .send({})
      expect(res.status).toBe(403)
    })
  }
})

describe('POST /api/v1/overlays/flood/refresh-all', () => {
  it('succeeds for admin', async () => {
    const res = await request(app)
      .post('/api/v1/overlays/flood/refresh-all')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ refreshed: 10 })
  })
})

describe('POST /api/v1/overlays/flood/:district/refresh', () => {
  it('succeeds for admin', async () => {
    const res = await request(app)
      .post('/api/v1/overlays/flood/camden/refresh')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ district: 'camden', refreshed: 3 })
  })
})

describe('POST /api/v1/overlays/parks/refresh-all', () => {
  it('succeeds for admin', async () => {
    const res = await request(app)
      .post('/api/v1/overlays/parks/refresh-all')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ refreshed: 5 })
  })
})

describe('POST /api/v1/overlays/parks/:district/refresh', () => {
  it('succeeds for admin', async () => {
    const res = await request(app)
      .post('/api/v1/overlays/parks/islington/refresh')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ district: 'islington', refreshed: 2 })
  })
})

describe('POST /api/v1/overlays/schools/ingest', () => {
  it('succeeds for admin', async () => {
    const res = await request(app)
      .post('/api/v1/overlays/schools/ingest')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ csvUrl: 'https://get-information-schools.service.gov.uk/schools.csv' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ inserted: 100, updated: 20 })
  })
})

describe('POST /api/v1/overlays/schools/geocode', () => {
  it('succeeds for admin', async () => {
    const res = await request(app)
      .post('/api/v1/overlays/schools/geocode')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ limit: 50 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ geocoded: 50 })
  })
})

describe('GET /api/v1/overlays/schools/near', () => {
  it('does NOT require auth (public endpoint)', async () => {
    const res = await request(app)
      .get('/api/v1/overlays/schools/near')
      .query({ lat: 51.501, lng: -0.1415, radius_km: 5 })
    expect(res.status).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
    expect(res.body.meta).toBeDefined()
  })

  it('returns 400 when no postcode or lat/lng provided', async () => {
    const res = await request(app).get('/api/v1/overlays/schools/near')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('postcode or lat/lng required')
  })

  it('filters by phase when specified', async () => {
    const res = await request(app)
      .get('/api/v1/overlays/schools/near')
      .query({ lat: 51.501, lng: -0.1415, radius_km: 5, phase: 'Primary' })
    expect(res.status).toBe(200)
    // All returned items should be Primary phase
    for (const s of res.body.data) {
      expect(s.phase).toBe('Primary')
    }
  })

  it('returns schools with distance_km populated', async () => {
    const res = await request(app)
      .get('/api/v1/overlays/schools/near')
      .query({ lat: 51.501, lng: -0.1415, radius_km: 5 })
    expect(res.status).toBe(200)
    for (const s of res.body.data) {
      expect(typeof s.distance_km).toBe('number')
    }
  })

  it('geocodes postcode when lat/lng not provided', async () => {
    const res = await request(app)
      .get('/api/v1/overlays/schools/near')
      .query({ postcode: 'SW1A 1AA', radius_km: 5 })
    expect(res.status).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
  })
})
