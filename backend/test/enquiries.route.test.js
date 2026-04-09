import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const USER = { id: 'user-1', email: 'user@example.com' }
const userToken = 'user-token'

const store = {
  enquiries: [],
  nurseries: new Map(),
}

function makeQueryBuilder(table) {
  const state = { table, op: 'select', filters: [], insertRow: null, selectCols: '' }
  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([c, op, v]) =>
        op === 'eq' ? r[c] === v : op === 'in' ? v.includes(r[c]) : true
      )
    )
  }
  const builder = {
    select(cols) {
      state.selectCols = cols || ''
      return builder
    },
    insert(row) {
      state.op = 'insert'
      state.insertRow = row
      return builder
    },
    eq(c, v) {
      state.filters.push([c, 'eq', v])
      return builder
    },
    in(c, v) {
      state.filters.push([c, 'in', v])
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
    then(onF, onR) {
      return builder._resolve(false, false).then(onF, onR)
    },
    async _resolve(single, maybe) {
      if (table === 'enquiries') {
        if (state.op === 'insert') {
          const row = {
            id: `e-${store.enquiries.length + 1}`,
            sent_at: new Date().toISOString(),
            ...state.insertRow,
          }
          store.enquiries.push(row)
          return single ? { data: row, error: null } : { data: [row], error: null }
        }
        const rows = applyFilters(store.enquiries).map((e) => {
          const n = [...store.nurseries.values()].find((n) => n.id === e.nursery_id)
          return { ...e, nurseries: n ? { name: n.name, urn: n.urn, town: n.town } : null }
        })
        if (single || maybe) return { data: rows[0] ?? null, error: null }
        return { data: rows, error: null }
      }
      if (table === 'nurseries') {
        const all = [...store.nurseries.values()]
        const rows = applyFilters(all)
        if (single || maybe) return { data: rows[0] ?? null, error: null }
        return { data: rows, error: null }
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
  chunkPostcodes: (arr, n) => {
    const out = []
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
    return out
  },
}))

vi.mock('../src/services/emailService.js', () => ({
  sendEmail: vi.fn(async () => ({ messageId: 'test-123' })),
  isEmailAvailable: () => false,
  escapeHtml: (s) => String(s || ''),
  EmailNotConfiguredError: class extends Error {},
  EmailSendError: class extends Error {},
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
  store.enquiries = []
  store.nurseries.clear()
  store.nurseries.set('n-1', {
    id: 'n-1',
    urn: 'EY100',
    name: 'Sunny',
    town: 'London',
    contact_email: null,
    email: null,
    claimed_by_user_id: null,
  })
  store.nurseries.set('n-2', {
    id: 'n-2',
    urn: 'EY101',
    name: 'Bright',
    town: 'Leeds',
    contact_email: null,
    email: null,
    claimed_by_user_id: null,
  })
})

describe('POST /api/v1/enquiries', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/v1/enquiries').send({})
    expect(res.status).toBe(401)
  })

  it('creates enquiries for multiple nurseries', async () => {
    const res = await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        nursery_ids: ['n-1', 'n-2'],
        child_name: 'Alice',
        message: 'Interested in a place',
      })
    expect(res.status).toBe(201)
    expect(res.body.data.length).toBe(2)
    expect(res.body.meta.sent).toBe(2)
  })

  it('rejects empty nursery_ids', async () => {
    const res = await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ nursery_ids: [] })
    expect(res.status).toBe(400)
  })

  it('rejects more than 10 nurseries', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `n-${i}`)
    const res = await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ nursery_ids: ids })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/v1/enquiries/mine', () => {
  it('returns empty list when no enquiries', async () => {
    const res = await request(app)
      .get('/api/v1/enquiries/mine')
      .set('Authorization', `Bearer ${userToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('returns enquiries after creation', async () => {
    await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ nursery_ids: ['n-1'], child_name: 'Bob' })

    const res = await request(app)
      .get('/api/v1/enquiries/mine')
      .set('Authorization', `Bearer ${userToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)
  })
})
