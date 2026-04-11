import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// Set env vars before any module imports (supabaseAuth.js checks these at load time)
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

// In-memory stores
const store = {
  questions: [],
  answers: [],
  claims: [],
}

function makeQueryBuilder(table) {
  const state = {
    table,
    op: 'select',
    filters: [],
    orderBy: null,
    insertRow: null,
    selectAfterInsert: false,
    inFilters: [],
  }

  function applyFilters(rows) {
    return rows.filter((r) => {
      const andMatch = state.filters.every(([col, op, val]) => {
        if (op === 'eq') return r[col] === val
        return true
      })
      if (!andMatch) return false
      const inMatch = state.inFilters.every(([col, vals]) => vals.includes(r[col]))
      return inMatch
    })
  }

  const builder = {
    select(_cols, opts) {
      state.op = state.op === 'insert' ? 'insert' : 'select'
      if (state.op === 'insert') state.selectAfterInsert = true
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
    in(col, vals) {
      state.inFilters.push([col, vals])
      return builder
    },
    update(row) {
      state.op = 'update'
      state.updateRow = row
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
      const tbl = state.table

      if (state.op === 'update') {
        // Fire-and-forget updates (e.g. last_active_at) — just return success
        return { data: null, error: null }
      }

      if (state.op === 'insert') {
        let targetStore
        if (tbl === 'nursery_questions') targetStore = store.questions
        else if (tbl === 'nursery_answers') targetStore = store.answers
        else return { data: null, error: null }

        const row = {
          id: `${tbl}-${targetStore.length + 1}`,
          created_at: new Date().toISOString(),
          ...state.insertRow,
        }
        targetStore.push(row)
        if (single) return { data: row, error: null }
        return { data: [row], error: null }
      }

      // select
      let sourceStore
      if (tbl === 'nursery_questions') sourceStore = store.questions
      else if (tbl === 'nursery_answers') sourceStore = store.answers
      else if (tbl === 'nursery_claims') sourceStore = store.claims
      else return { data: [], error: null }

      let rows = applyFilters(sourceStore)

      if (single || maybe) {
        return { data: rows[0] ?? null, error: null }
      }
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

const TEST_USER = { id: 'user-qa-1', email: 'parent@example.com' }
const PROVIDER_USER = { id: 'user-provider-1', email: 'provider@example.com' }
const validToken = 'qa-valid-token'
const providerToken = 'qa-provider-token'

vi.mock('@supabase/supabase-js', async () => ({
  createClient: () => ({
    auth: {
      getUser: async (token) => {
        if (token === validToken) return { data: { user: TEST_USER }, error: null }
        if (token === providerToken) return { data: { user: PROVIDER_USER }, error: null }
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
  store.questions = []
  store.answers = []
  store.claims = []
})

const TEST_URN = 'EY500'

describe('GET /api/v1/nurseries/:urn/questions', () => {
  it('returns an empty list when no questions exist (public, no auth needed)', async () => {
    const res = await request(app).get(`/api/v1/nurseries/${TEST_URN}/questions`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ questions: [] })
  })

  it('returns published questions with their answers', async () => {
    // Seed a published question
    store.questions.push({
      id: 'q-1',
      nursery_urn: TEST_URN,
      user_id: TEST_USER.id,
      question: 'What are the opening hours?',
      status: 'published',
      created_at: new Date().toISOString(),
    })
    // Seed an answer for that question
    store.answers.push({
      id: 'a-1',
      question_id: 'q-1',
      user_id: PROVIDER_USER.id,
      is_provider: true,
      answer: 'We are open 7am to 6pm.',
      status: 'published',
      created_at: new Date().toISOString(),
    })

    const res = await request(app).get(`/api/v1/nurseries/${TEST_URN}/questions`)
    expect(res.status).toBe(200)
    expect(res.body.questions).toHaveLength(1)
    expect(res.body.questions[0].id).toBe('q-1')
    expect(res.body.questions[0].answers).toHaveLength(1)
    expect(res.body.questions[0].answers[0].id).toBe('a-1')
  })
})

describe('POST /api/v1/nurseries/:urn/questions', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post(`/api/v1/nurseries/${TEST_URN}/questions`)
      .send({ question: 'What is the staff to child ratio here?' })
    expect(res.status).toBe(401)
  })

  it('creates a question with valid auth and returns 201', async () => {
    const res = await request(app)
      .post(`/api/v1/nurseries/${TEST_URN}/questions`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ question: 'What is the staff to child ratio here?' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      nursery_urn: TEST_URN,
      user_id: TEST_USER.id,
      question: 'What is the staff to child ratio here?',
      status: 'published',
    })
  })

  it('rejects a question that is too short', async () => {
    const res = await request(app)
      .post(`/api/v1/nurseries/${TEST_URN}/questions`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ question: 'Short?' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/v1/nurseries/:urn/questions/:questionId/answers', () => {
  const seedQuestion = () => {
    store.questions.push({
      id: 'q-seed',
      nursery_urn: TEST_URN,
      user_id: TEST_USER.id,
      question: 'Do you offer flexible hours?',
      status: 'published',
      created_at: new Date().toISOString(),
    })
  }

  it('rejects unauthenticated requests with 401', async () => {
    seedQuestion()
    const res = await request(app)
      .post(`/api/v1/nurseries/${TEST_URN}/questions/q-seed/answers`)
      .send({ answer: 'Yes we offer flexible morning and afternoon sessions.' })
    expect(res.status).toBe(401)
  })

  it('rejects non-provider users with 403', async () => {
    seedQuestion()
    // No claim exists for TEST_USER, so they are not a provider
    const res = await request(app)
      .post(`/api/v1/nurseries/${TEST_URN}/questions/q-seed/answers`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ answer: 'Yes we offer flexible morning and afternoon sessions.' })
    expect(res.status).toBe(403)
  })

  it('allows a provider with an approved claim to answer (201)', async () => {
    seedQuestion()
    // Seed an approved claim for the provider user
    store.claims.push({
      id: 'claim-1',
      urn: TEST_URN,
      user_id: PROVIDER_USER.id,
      status: 'approved',
    })

    const res = await request(app)
      .post(`/api/v1/nurseries/${TEST_URN}/questions/q-seed/answers`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ answer: 'Yes we offer flexible morning and afternoon sessions.' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      question_id: 'q-seed',
      user_id: PROVIDER_USER.id,
      is_provider: true,
      answer: 'Yes we offer flexible morning and afternoon sessions.',
      status: 'published',
    })
  })
})

describe('POST /api/v1/nurseries/:urn/questions/:questionId/vote', () => {
  it('returns 404 because the vote endpoint is not yet implemented', async () => {
    const res = await request(app)
      .post(`/api/v1/nurseries/${TEST_URN}/questions/q-1/vote`)
      .set('Authorization', `Bearer ${validToken}`)
    // No route matches, so Express returns 404
    expect(res.status).toBe(404)
  })
})
