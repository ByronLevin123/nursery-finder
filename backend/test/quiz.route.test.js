import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const USER = { id: 'user-1', email: 'user@example.com' }
const userToken = 'user-token'

const store = {
  quizResponses: new Map(),
}

function makeQueryBuilder(table) {
  const state = { table, op: 'select', filters: [], insertRow: null, updateRow: null }
  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([c, op, v]) => (op === 'eq' ? r[c] === v : op === 'in' ? v.includes(r[c]) : true))
    )
  }
  const builder = {
    select() { return builder },
    insert(row) { state.op = 'insert'; state.insertRow = row; return builder },
    update(row) { state.op = 'update'; state.updateRow = row; return builder },
    delete() { state.op = 'delete'; return builder },
    eq(c, v) { state.filters.push([c, 'eq', v]); return builder },
    in(c, v) { state.filters.push([c, 'in', v]); return builder },
    order() { return builder },
    range() { return builder },
    limit() { return builder },
    single() { return builder._resolve(true, false) },
    maybeSingle() { return builder._resolve(true, true) },
    then(onF, onR) { return builder._resolve(false, false).then(onF, onR) },
    async _resolve(single, maybe) {
      if (table === 'user_quiz_responses') {
        if (state.op === 'insert') {
          const row = { id: `q-${store.quizResponses.size + 1}`, created_at: new Date().toISOString(), ...state.insertRow }
          store.quizResponses.set(row.user_id, row)
          return single ? { data: row, error: null } : { data: [row], error: null }
        }
        if (state.op === 'update') {
          const rows = applyFilters([...store.quizResponses.values()])
          const updated = rows.map(r => {
            const merged = { ...r, ...state.updateRow }
            store.quizResponses.set(merged.user_id, merged)
            return merged
          })
          return single ? { data: updated[0] ?? null, error: null } : { data: updated, error: null }
        }
        const rows = applyFilters([...store.quizResponses.values()])
        if (single || maybe) return { data: rows[0] ?? null, error: null }
        return { data: rows, error: null }
      }
      if (table === 'user_profiles') {
        return { data: { home_postcode: 'SW1A 1AA', work_postcode: 'EC2M 1QS', role: 'customer' }, error: null }
      }
      if (table === 'nurseries') {
        const mockNurseries = [
          { urn: 'EY100', name: 'Sunny', town: 'London', quality_score: 80, cost_score: 60, ofsted_overall_grade: 'Good' },
          { urn: 'EY101', name: 'Bright', town: 'London', quality_score: 95, cost_score: 40, ofsted_overall_grade: 'Outstanding' },
        ]
        const filtered = applyFilters(mockNurseries)
        if (single || maybe) return { data: filtered[0] ?? null, error: null }
        return { data: filtered, error: null }
      }
      return { data: single ? null : [], error: null }
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
      getUser: async (token) => {
        if (token === userToken) return { data: { user: USER }, error: null }
        return { data: { user: null }, error: { message: 'invalid' } }
      },
    },
  }),
}))

vi.mock('../src/services/geocoding.js', () => ({
  geocodePostcode: vi.fn(async () => ({ lat: 51.5, lng: -0.1 })),
  chunkPostcodes: (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out },
}))

vi.mock('../src/services/reviewNlp.js', () => ({
  extractCategoryScores: vi.fn(async () => null),
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
  store.quizResponses.clear()
})

describe('POST /api/v1/quiz/submit', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/v1/quiz/submit').send({})
    expect(res.status).toBe(401)
  })

  it('creates a quiz response', async () => {
    const res = await request(app)
      .post('/api/v1/quiz/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        urgency: 'asap',
        commute_from: 'home',
        commute_postcode: 'SW1A 1AA',
        priority_order: ['quality', 'cost', 'location'],
      })
    expect(res.status).toBe(200)
    expect(res.body.urgency).toBe('asap')
    expect(res.body.user_id).toBe(USER.id)
  })

  it('rejects invalid urgency', async () => {
    const res = await request(app)
      .post('/api/v1/quiz/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ urgency: 'invalid' })
    expect(res.status).toBe(400)
  })

  it('rejects invalid priority', async () => {
    const res = await request(app)
      .post('/api/v1/quiz/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ priority_order: ['invalid_dim'] })
    expect(res.status).toBe(400)
  })

  it('updates on re-submit', async () => {
    await request(app)
      .post('/api/v1/quiz/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ urgency: 'asap' })

    const res = await request(app)
      .post('/api/v1/quiz/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ urgency: '6_months' })
    expect(res.status).toBe(200)
    expect(res.body.urgency).toBe('6_months')
  })
})

describe('GET /api/v1/quiz/mine', () => {
  it('returns null when no quiz exists', async () => {
    const res = await request(app)
      .get('/api/v1/quiz/mine')
      .set('Authorization', `Bearer ${userToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
  })

  it('returns the quiz after submission', async () => {
    await request(app)
      .post('/api/v1/quiz/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ urgency: 'exploring' })

    const res = await request(app)
      .get('/api/v1/quiz/mine')
      .set('Authorization', `Bearer ${userToken}`)
    expect(res.status).toBe(200)
    expect(res.body.urgency).toBe('exploring')
  })
})

describe('GET /api/v1/recommendations', () => {
  it('returns 404 when no quiz response', async () => {
    const res = await request(app)
      .get('/api/v1/recommendations')
      .set('Authorization', `Bearer ${userToken}`)
    expect(res.status).toBe(404)
  })

  it('returns recommendations after quiz submission', async () => {
    await request(app)
      .post('/api/v1/quiz/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ urgency: 'asap', commute_postcode: 'SW1A 1AA' })

    const res = await request(app)
      .get('/api/v1/recommendations')
      .set('Authorization', `Bearer ${userToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('meta')
  })
})
