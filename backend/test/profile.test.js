import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// In-memory store for user_profiles
const store = {
  profiles: new Map(),
}

const TEST_USER = { id: 'user-123', email: 'test@example.com' }

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
      if (table !== 'user_profiles') {
        return { data: single ? null : [], error: null }
      }
      if (state.op === 'insert') {
        const row = {
          id: state.insertRow.id,
          display_name: null,
          avatar_url: null,
          home_postcode: null,
          children: [],
          preferences: null,
          email_alerts: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...state.insertRow,
        }
        store.profiles.set(row.id, row)
        return { data: single ? row : [row], error: null }
      }
      if (state.op === 'update') {
        const rows = applyFilters([...store.profiles.values()])
        const updated = rows.map((r) => {
          const merged = { ...r, ...state.updateRow }
          store.profiles.set(r.id, merged)
          return merged
        })
        if (single) return { data: updated[0] ?? null, error: null }
        return { data: updated, error: null }
      }
      // select
      const rows = applyFilters([...store.profiles.values()])
      if (single) return { data: rows[0] ?? (maybe ? null : null), error: null }
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

// Mock the supabase auth client used by middleware
const validToken = 'valid-token'
vi.mock('@supabase/supabase-js', async () => {
  return {
    createClient: () => ({
      auth: {
        getUser: async (token) => {
          if (token === validToken) {
            return { data: { user: TEST_USER }, error: null }
          }
          return { data: { user: null }, error: { message: 'invalid' } }
        },
      },
    }),
  }
})

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
  store.profiles.clear()
  // Pre-seed profile row for the test user
  store.profiles.set(TEST_USER.id, {
    id: TEST_USER.id,
    display_name: null,
    avatar_url: null,
    home_postcode: null,
    children: [],
    preferences: null,
    email_alerts: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
})

describe('GET /api/v1/profile', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/profile')
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const res = await request(app).get('/api/v1/profile').set('Authorization', 'Bearer wrong')
    expect(res.status).toBe(401)
  })

  it('returns the profile for the authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${validToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(TEST_USER.id)
  })
})

describe('PATCH /api/v1/profile', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/v1/profile').send({ display_name: 'X' })
    expect(res.status).toBe(401)
  })

  it('updates allowed fields with valid auth', async () => {
    const res = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        display_name: 'Byron',
        home_postcode: 'SW11 1AA',
        email_alerts: true,
        children: [{ name: 'A', age_months: 18 }],
      })
    expect(res.status).toBe(200)
    expect(res.body.display_name).toBe('Byron')
    expect(res.body.home_postcode).toBe('SW11 1AA')
    expect(res.body.email_alerts).toBe(true)
    expect(res.body.children).toEqual([{ name: 'A', age_months: 18 }])
  })

  it('rejects invalid display_name length', async () => {
    const res = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ display_name: 'x'.repeat(200) })
    expect(res.status).toBe(400)
  })
})
