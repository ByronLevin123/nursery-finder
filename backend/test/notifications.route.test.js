import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// Set env vars before any module imports
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

// In-memory store
const store = {
  notifications: [],
  user_profiles: [],
}

function makeQueryBuilder(table) {
  const state = {
    table,
    op: 'select',
    filters: [],
    isFilters: [],
    insertRow: null,
    updateRow: null,
    countMode: null,
  }

  function applyFilters(rows) {
    let result = rows.filter((r) =>
      state.filters.every(([col, op, val]) => {
        if (op === 'eq') return r[col] === val
        return true
      })
    )
    result = result.filter((r) => state.isFilters.every(([col, val]) => r[col] === val))
    return result
  }

  const builder = {
    select(_cols, opts) {
      // Don't reset op if we're chaining select after insert/update/upsert
      if (state.op !== 'insert' && state.op !== 'update' && state.op !== 'upsert') {
        state.op = 'select'
      }
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
    is(col, val) {
      state.isFilters.push([col, val])
      return builder
    },
    not() {
      return builder
    },
    ilike() {
      return builder
    },
    like() {
      return builder
    },
    in() {
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
      state.singleMode = true
      return builder._resolve(true, false)
    },
    maybeSingle() {
      state.maybeMode = true
      return builder._resolve(true, true)
    },
    then(onFulfilled, onRejected) {
      return builder._resolve(false, false).then(onFulfilled, onRejected)
    },
    async _resolve(single, maybe) {
      const rows = store[state.table] || []

      if (state.op === 'update') {
        // Apply filters including 'is' filters
        let matching = rows.filter((r) =>
          state.filters.every(([col, op, val]) => {
            if (op === 'eq') return r[col] === val
            return true
          })
        )
        matching = matching.filter((r) => state.isFilters.every(([col, val]) => r[col] === val))
        const updated = matching.map((r) => {
          const merged = { ...r, ...state.updateRow }
          const idx = rows.indexOf(r)
          if (idx >= 0) rows[idx] = merged
          return merged
        })
        if (single || maybe) {
          if (updated.length === 0 && !maybe) {
            return { data: null, error: { message: 'Row not found' } }
          }
          return { data: updated[0] ?? null, error: null }
        }
        return { data: updated, error: null }
      }

      if (state.op === 'select') {
        let result = applyFilters(rows)
        if (state.countMode) {
          return { data: result, error: null, count: result.length }
        }
        if (single || maybe) {
          if (result.length === 0 && !maybe) {
            return { data: null, error: { message: 'Row not found' } }
          }
          return { data: result[0] ?? null, error: null }
        }
        return { data: result, error: null }
      }

      return { data: null, error: null }
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

const TEST_USER = { id: 'user-notif-1', email: 'parent@example.com' }
const validToken = 'notif-valid-token'

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
  store.notifications = []
  store.user_profiles = []
})

describe('GET /api/v1/notifications', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/notifications')
    expect(res.status).toBe(401)
  })

  it('returns empty list when no notifications exist', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${validToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: [] })
  })

  it('returns notifications for authenticated user', async () => {
    store.notifications.push(
      {
        id: 'n-1',
        user_id: TEST_USER.id,
        type: 'review_reply',
        message: 'Your review got a reply',
        read_at: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'n-2',
        user_id: TEST_USER.id,
        type: 'claim_approved',
        message: 'Your claim was approved',
        read_at: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'n-other',
        user_id: 'other-user',
        type: 'review_reply',
        message: 'Not for this user',
        read_at: null,
        created_at: new Date().toISOString(),
      }
    )

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${validToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data.every((n) => n.user_id === TEST_USER.id)).toBe(true)
  })
})

describe('PATCH /api/v1/notifications/:id/read', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).patch('/api/v1/notifications/n-1/read')
    expect(res.status).toBe(401)
  })

  it('marks a notification as read', async () => {
    store.notifications.push({
      id: 'n-mark',
      user_id: TEST_USER.id,
      type: 'info',
      message: 'Test notification',
      read_at: null,
      created_at: new Date().toISOString(),
    })

    const res = await request(app)
      .patch('/api/v1/notifications/n-mark/read')
      .set('Authorization', `Bearer ${validToken}`)
    expect(res.status).toBe(200)
    expect(res.body.read_at).toBeTruthy()
  })

  it('returns 404 for non-existent notification', async () => {
    const res = await request(app)
      .patch('/api/v1/notifications/non-existent/read')
      .set('Authorization', `Bearer ${validToken}`)
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/v1/notifications/read-all', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).patch('/api/v1/notifications/read-all')
    expect(res.status).toBe(401)
  })

  it('marks all unread notifications as read', async () => {
    store.notifications.push(
      {
        id: 'n-r1',
        user_id: TEST_USER.id,
        type: 'info',
        message: 'Unread 1',
        read_at: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'n-r2',
        user_id: TEST_USER.id,
        type: 'info',
        message: 'Unread 2',
        read_at: null,
        created_at: new Date().toISOString(),
      }
    )

    const res = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${validToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})
