import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const OWNER = { id: 'owner-1', email: 'owner@example.com' }
const ownerToken = 'owner-token'

const store = {
  nurseries: new Map(),
  enquiries: new Map(),
  visit_bookings: new Map(),
  visit_surveys: new Map(),
}

function makeQueryBuilder(table) {
  const state = { table, op: 'select', filters: [] }
  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([c, op, v]) => {
        if (op === 'eq') return r[c] === v
        if (op === 'in') return v.includes(r[c])
        return true
      })
    )
  }
  function getMap() {
    if (table === 'nurseries') return store.nurseries
    if (table === 'enquiries') return store.enquiries
    if (table === 'visit_bookings') return store.visit_bookings
    if (table === 'visit_surveys') return store.visit_surveys
    return new Map()
  }
  const builder = {
    select() { return builder },
    eq(c, v) { state.filters.push([c, 'eq', v]); return builder },
    in(c, v) { state.filters.push([c, 'in', v]); return builder },
    order() { return builder },
    single() { return builder._resolve(true) },
    maybeSingle() { return builder._resolve(true) },
    then(onF, onR) { return builder._resolve(false).then(onF, onR) },
    async _resolve(single) {
      const rows = applyFilters([...getMap().values()])
      if (single) return { data: rows[0] ?? null, error: null }
      return { data: rows, error: null }
    },
  }
  return builder
}

vi.mock('../src/db.js', () => ({
  default: {
    from: (table) => makeQueryBuilder(table),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}))

vi.mock('@supabase/supabase-js', async () => ({
  createClient: () => ({
    auth: {
      getUser: async (token) => {
        if (token === ownerToken) return { data: { user: OWNER }, error: null }
        return { data: { user: null }, error: { message: 'invalid' } }
      },
    },
  }),
}))

vi.mock('../src/services/geocoding.js', () => ({
  geocodePostcode: vi.fn(async () => ({ lat: 51.5, lng: -0.1 })),
  chunkPostcodes: (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out },
}))

vi.mock('../src/services/emailService.js', () => ({
  sendEmail: vi.fn(async () => ({ messageId: 'test-123' })),
  isEmailAvailable: () => false,
  escapeHtml: (s) => String(s || ''),
  renderEnquiryNotificationEmail: vi.fn(() => ({ subject: 'test', html: '<p>test</p>', text: 'test' })),
  EmailNotConfiguredError: class extends Error {},
  EmailSendError: class extends Error {},
}))

vi.mock('../src/services/reviewNlp.js', () => ({
  extractCategoryScores: vi.fn(async () => null),
}))

let app, request
beforeAll(async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_ANON_KEY = 'anon-test-key'
  app = (await import('../src/app.js')).default
  request = (await import('supertest')).default
})

beforeEach(() => {
  store.nurseries.clear()
  store.enquiries.clear()
  store.visit_bookings.clear()
  store.visit_surveys.clear()
  store.nurseries.set('n-1', {
    id: 'n-1', urn: 'EY100', name: 'Sunny', town: 'London',
    claimed_by_user_id: OWNER.id,
    view_count: 42, compare_count: 7,
  })
  store.enquiries.set('e-1', {
    id: 'e-1', nursery_id: 'n-1', status: 'responded',
    sent_at: new Date().toISOString(),
  })
  store.visit_bookings.set('b-1', {
    id: 'b-1', nursery_id: 'n-1', status: 'completed', created_at: new Date().toISOString(),
  })
  store.visit_surveys.set('s-1', {
    id: 's-1', nursery_id: 'n-1', overall_impression: 4, staff_friendliness: 5, facilities_quality: 3,
  })
})

describe('GET /api/v1/provider/analytics', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/v1/provider/analytics')
    expect(res.status).toBe(401)
  })

  it('returns analytics for owned nurseries', async () => {
    const res = await request(app)
      .get('/api/v1/provider/analytics')
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)
    const stat = res.body.data[0]
    expect(stat.name).toBe('Sunny')
    expect(stat.view_count).toBe(42)
    expect(stat.compare_count).toBe(7)
    expect(stat.enquiries.total).toBe(1)
    expect(stat.visits.total).toBe(1)
    expect(stat.visits.completed).toBe(1)
    expect(stat.survey_avg.overall).toBe(4)
    expect(stat.survey_avg.count).toBe(1)
  })
})
