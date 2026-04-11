process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

import { describe, it, expect, vi, beforeAll } from 'vitest'

// ---------- in-memory store ----------
const store = {
  user_profiles: [],
  nurseries: [
    {
      urn: 'EY100',
      name: 'Sunshine Nursery',
      registration_status: 'Active',
      ofsted_overall_grade: 'Outstanding',
      lat: 51.534,
      lng: -0.139,
      location: true,
      town: 'Camden',
    },
    {
      urn: 'EY101',
      name: 'Rainbow Nursery',
      registration_status: 'Active',
      ofsted_overall_grade: 'Good',
      lat: 51.535,
      lng: -0.138,
      location: true,
      town: 'Camden',
    },
    {
      urn: 'EY102',
      name: 'Star Nursery',
      registration_status: 'Active',
      ofsted_overall_grade: 'Outstanding',
      lat: 51.536,
      lng: -0.140,
      location: true,
      town: 'Camden',
    },
    {
      urn: 'EY999',
      name: 'No Location Nursery',
      registration_status: 'Active',
      ofsted_overall_grade: 'Good',
      lat: null,
      lng: null,
      location: null,
      town: 'Nowhere',
    },
  ],
}

const rpcResults = {}

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
        if (op === 'in') return val.includes(r[col])
        if (op === 'not_is') return r[col] != null
        if (op === 'ilike') {
          const regex = new RegExp('^' + val.replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i')
          return regex.test(r[col])
        }
        return true
      })
    )
  }

  const builder = {
    select() { return builder },
    insert(row) { state.op = 'insert'; return builder },
    update(row) { state.op = 'update'; return builder },
    eq(col, val) { state.filters.push([col, 'eq', val]); return builder },
    in(col, vals) { state.filters.push([col, 'in', vals]); return builder },
    ilike(col, val) { state.filters.push([col, 'ilike', val]); return builder },
    not(col, _is, _null) { state.filters.push([col, 'not_is', null]); return builder },
    or() { return builder },
    gt() { return builder },
    gte() { return builder },
    order() { return builder },
    range() { return builder },
    limit() { return builder },
    single() { return builder._resolve(true, false) },
    maybeSingle() { return builder._resolve(true, true) },
    then(resolve, reject) { return builder._resolve(false, false).then(resolve, reject) },
    async _resolve(single, maybe) {
      if (state.op === 'insert' || state.op === 'update') {
        return { data: null, error: null }
      }
      const source = store[table] || []
      let rows = applyFilters(source)
      if (single) {
        if (rows.length === 0 && !maybe) {
          return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
        }
        return { data: rows[0] ?? null, error: null }
      }
      return { data: rows, error: null }
    },
  }
  return builder
}

// ---------- mocks ----------
vi.mock('../src/db.js', () => ({
  default: {
    from: (table) => makeQueryBuilder(table),
    rpc: vi.fn(async (name, params) => {
      if (name === 'search_nurseries_near') {
        // Return nearby nurseries based on our store — simulate spatial search
        const nearby = store.nurseries
          .filter((n) => n.lat != null && n.lng != null && n.registration_status === 'Active')
          .map((n) => ({
            ...n,
            distance_km: Math.sqrt((n.lat - params.search_lat) ** 2 + (n.lng - params.search_lng) ** 2) * 111,
          }))
          .filter((n) => n.distance_km <= params.radius_km)
          .sort((a, b) => a.distance_km - b.distance_km)
        return { data: nearby, error: null }
      }
      return { data: [], error: null }
    }),
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

// ---------- GET /api/v1/nurseries/:urn/similar ----------

describe('GET /api/v1/nurseries/:urn/similar', () => {
  it('returns an array of similar nurseries for a known URN', async () => {
    const res = await request(app).get('/api/v1/nurseries/EY100/similar')
    expect(res.status).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
    // Should not include the nursery itself
    const urns = res.body.data.map((n) => n.urn)
    expect(urns).not.toContain('EY100')
  })

  it('returns at most 6 similar nurseries', async () => {
    const res = await request(app).get('/api/v1/nurseries/EY100/similar')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeLessThanOrEqual(6)
  })

  it('returns 404 for a non-existent URN', async () => {
    const res = await request(app).get('/api/v1/nurseries/NONEXIST/similar')
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('not found')
  })

  it('returns empty array for a nursery with no location', async () => {
    const res = await request(app).get('/api/v1/nurseries/EY999/similar')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('prioritises same-grade nurseries in results', async () => {
    const res = await request(app).get('/api/v1/nurseries/EY100/similar')
    expect(res.status).toBe(200)
    if (res.body.data.length >= 2) {
      // EY100 is Outstanding — EY102 (Outstanding) should come before EY101 (Good) if equidistant
      const outstandingIdx = res.body.data.findIndex((n) => n.ofsted_overall_grade === 'Outstanding')
      const goodIdx = res.body.data.findIndex((n) => n.ofsted_overall_grade === 'Good')
      if (outstandingIdx >= 0 && goodIdx >= 0) {
        expect(outstandingIdx).toBeLessThan(goodIdx)
      }
    }
  })

  it('does not require authentication (public endpoint)', async () => {
    const res = await request(app).get('/api/v1/nurseries/EY100/similar')
    // No Authorization header sent — should still succeed
    expect(res.status).toBe(200)
  })
})
