import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// Set env vars before any module imports (supabaseAuth.js checks these at load time)
process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_ANON_KEY = 'anon-test-key'

// In-memory store of reviews keyed by ip_hash
const store = {
  reviews: [],
}

function makeQueryBuilder(table) {
  // Build up state then resolve when awaited or .single()/.maybeSingle() called
  const state = {
    table,
    op: 'select',
    filters: [],
    orFilters: null,
    orderBy: null,
    rangeFrom: null,
    rangeTo: null,
    insertRow: null,
    selectAfterInsert: false,
    countMode: null,
  }

  function applyFilters(rows) {
    return rows.filter((r) => {
      const andMatch = state.filters.every(([col, op, val]) => {
        if (op === 'eq') return r[col] === val
        if (op === 'gte') return r[col] >= val
        return true
      })
      if (!andMatch) return false
      if (state.orFilters && state.orFilters.length > 0) {
        return state.orFilters.some(([col, op, val]) => {
          if (op === 'eq') return String(r[col]) === val
          return true
        })
      }
      return true
    })
  }

  const builder = {
    select(_cols, opts) {
      state.op = state.op === 'insert' ? 'insert' : 'select'
      if (state.op === 'insert') state.selectAfterInsert = true
      if (opts && opts.count) state.countMode = opts.count
      return builder
    },
    insert(row) {
      state.op = 'insert'
      state.insertRow = row
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
    order(col, opts) {
      state.orderBy = { col, asc: opts?.ascending !== false }
      return builder
    },
    range(from, to) {
      state.rangeFrom = from
      state.rangeTo = to
      return builder
    },
    update(row) {
      state.op = 'update'
      state.updateRow = row
      return builder
    },
    or(filter) {
      // Parse simple or filters like "user_id.eq.xxx,ip_hash.eq.yyy"
      const parts = filter.split(',')
      state.orFilters = parts.map((p) => {
        const [col, op, val] = p.split('.')
        return [col, op, val]
      })
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
      if (state.op === 'update') {
        // Just return success for updates (NLP category scores etc.)
        return { data: null, error: null }
      }
      if (state.op === 'insert') {
        if (table === 'nursery_reviews') {
          const row = {
            id: `r-${store.reviews.length + 1}`,
            created_at: new Date().toISOString(),
            ...state.insertRow,
          }
          store.reviews.push(row)
          if (single) return { data: row, error: null }
          return { data: [row], error: null }
        }
        return { data: null, error: null }
      }

      // select
      if (table === 'nursery_reviews') {
        let rows = applyFilters(store.reviews)
        if (state.orderBy) {
          rows = [...rows].sort((a, b) => {
            const av = a[state.orderBy.col]
            const bv = b[state.orderBy.col]
            return state.orderBy.asc ? (av > bv ? 1 : -1) : av < bv ? 1 : -1
          })
        }
        const total = rows.length
        if (state.rangeFrom != null) {
          rows = rows.slice(state.rangeFrom, state.rangeTo + 1)
        }
        if (single) {
          return { data: rows[0] ?? (maybe ? null : null), error: null }
        }
        return { data: rows, error: null, count: total }
      }
      if (table === 'nurseries') {
        // Return a stub with aggregate columns
        const stub = {
          review_count: 0,
          review_avg_rating: null,
          review_recommend_pct: null,
        }
        if (single || maybe) return { data: stub, error: null }
        return { data: [stub], error: null }
      }
      return { data: [], error: null }
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

// email_confirmed_at populated for requireVerifiedEmail on POST review.
const TEST_USER = {
  id: 'user-review-1',
  email: 'reviewer@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
}
const validToken = 'review-token'

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
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_ANON_KEY = 'anon-test-key'
  app = (await import('../src/app.js')).default
  request = (await import('supertest')).default
})

beforeEach(() => {
  store.reviews = []
})

const validReview = {
  rating: 5,
  title: 'Wonderful nursery',
  body: 'Our daughter has loved every minute here, the staff are kind and attentive.',
  would_recommend: true,
  child_age_months: 24,
  author_display_name: 'Parent of a 2-year-old',
}

describe('POST /api/v1/nurseries/:urn/reviews', () => {
  it('allows anonymous review submission', async () => {
    const res = await request(app).post('/api/v1/nurseries/EY100/reviews').send(validReview)
    expect(res.status).toBe(201)
    expect(res.body.user_id).toBeNull()
  })

  it('accepts a valid review and strips ip_hash from the response', async () => {
    const res = await request(app)
      .post('/api/v1/nurseries/EY100/reviews')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validReview)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      urn: 'EY100',
      rating: 5,
      title: 'Wonderful nursery',
    })
    expect(res.body.ip_hash).toBeUndefined()
  })

  it('rejects rating outside 1-5', async () => {
    const res1 = await request(app)
      .post('/api/v1/nurseries/EY101/reviews')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ ...validReview, rating: 0 })
    expect(res1.status).toBe(400)

    const res2 = await request(app)
      .post('/api/v1/nurseries/EY101/reviews')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ ...validReview, rating: 6 })
    expect(res2.status).toBe(400)
  })

  it('rejects too-short body', async () => {
    const res = await request(app)
      .post('/api/v1/nurseries/EY102/reviews')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ ...validReview, body: 'too short' })
    expect(res.status).toBe(400)
  })

  it('rejects a duplicate review for the same nursery from the same ip', async () => {
    const first = await request(app)
      .post('/api/v1/nurseries/EY103/reviews')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validReview)
    expect(first.status).toBe(201)

    const dup = await request(app)
      .post('/api/v1/nurseries/EY103/reviews')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validReview)
    expect(dup.status).toBe(409)
  })

  it('rate limits a 4th review from the same ip in 24h', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post(`/api/v1/nurseries/EY20${i}/reviews`)
        .set('Authorization', `Bearer ${validToken}`)
        .send(validReview)
      expect(res.status).toBe(201)
    }
    const fourth = await request(app)
      .post('/api/v1/nurseries/EY299/reviews')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validReview)
    expect(fourth.status).toBe(429)
  })
})

describe('GET /api/v1/nurseries/:urn/reviews', () => {
  it('returns an empty list for a nursery with no reviews', async () => {
    const res = await request(app).get('/api/v1/nurseries/EY999/reviews')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      reviews: [],
      total: 0,
      avg_rating: null,
      recommend_pct: null,
    })
  })
})
