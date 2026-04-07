import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const OWNER = { id: 'owner-1', email: 'owner@example.com' }
const OTHER = { id: 'other-1', email: 'other@example.com' }

const store = {
  nurseries: new Map(),
}

function makeQueryBuilder(table) {
  const state = { table, op: 'select', filters: [], updateRow: null }
  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([c, op, v]) => (op === 'eq' ? r[c] === v : true))
    )
  }
  const builder = {
    select() {
      return builder
    },
    update(row) {
      state.op = 'update'
      state.updateRow = row
      return builder
    },
    eq(c, v) {
      state.filters.push([c, 'eq', v])
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
    async _resolve(single) {
      if (table !== 'nurseries') return { data: single ? null : [], error: null }
      if (state.op === 'update') {
        const rows = applyFilters([...store.nurseries.values()])
        const updated = rows.map((r) => {
          const merged = { ...r, ...state.updateRow }
          store.nurseries.set(merged.urn, merged)
          return merged
        })
        if (single) return { data: updated[0] ?? null, error: null }
        return { data: updated, error: null }
      }
      const rows = applyFilters([...store.nurseries.values()])
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

let currentUser = OWNER
const ownerToken = 'owner-token'
const otherToken = 'other-token'
vi.mock('@supabase/supabase-js', async () => ({
  createClient: () => ({
    auth: {
      getUser: async (token) => {
        if (token === ownerToken) return { data: { user: OWNER }, error: null }
        if (token === otherToken) return { data: { user: OTHER }, error: null }
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
  app = (await import('../src/app.js')).default
  request = (await import('supertest')).default
})

beforeEach(() => {
  currentUser = OWNER
  store.nurseries.clear()
  store.nurseries.set('URN1', {
    urn: 'URN1',
    name: 'Sunny',
    town: 'London',
    claimed_by_user_id: OWNER.id,
  })
  store.nurseries.set('URN2', {
    urn: 'URN2',
    name: 'Other',
    town: 'Leeds',
    claimed_by_user_id: null,
  })
})

describe('PATCH /api/v1/provider/nurseries/:urn', () => {
  it('returns 403 when the caller is not the owner', async () => {
    const res = await request(app)
      .patch('/api/v1/provider/nurseries/URN1')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ description: 'hi' })
    expect(res.status).toBe(403)
  })

  it('updates editable fields for the owner', async () => {
    const res = await request(app)
      .patch('/api/v1/provider/nurseries/URN1')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        description: 'A wonderful place',
        website_url: 'https://example.com',
        photos: ['https://cdn.example.com/a.jpg'],
      })
    expect(res.status).toBe(200)
    expect(res.body.description).toBe('A wonderful place')
    expect(res.body.provider_updated_at).toBeTruthy()
  })

  it('rejects unknown fields', async () => {
    const res = await request(app)
      .patch('/api/v1/provider/nurseries/URN1')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'new name' })
    expect(res.status).toBe(400)
  })

  it('returns 404 for missing nursery', async () => {
    const res = await request(app)
      .patch('/api/v1/provider/nurseries/NOPE')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ description: 'x' })
    expect(res.status).toBe(404)
  })
})
