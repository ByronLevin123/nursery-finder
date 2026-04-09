import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const USER = { id: 'user-1', email: 'user@example.com' }
const OWNER = { id: 'owner-1', email: 'owner@example.com' }
const userToken = 'user-token'
const ownerToken = 'owner-token'

const store = {
  nurseries: new Map(),
  visit_slots: new Map(),
  visit_bookings: new Map(),
  visit_surveys: new Map(),
}

let idCounter = 0
function nextId() {
  return `id-${++idCounter}`
}

function makeQueryBuilder(table) {
  const state = {
    table,
    op: 'select',
    filters: [],
    insertRow: null,
    updateRow: null,
    deleteOp: false,
  }
  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([c, op, v]) => {
        if (op === 'eq') return r[c] === v
        if (op === 'gte') return r[c] >= v
        if (op === 'in') return v.includes(r[c])
        return true
      })
    )
  }
  function getMap() {
    if (table === 'visit_slots') return store.visit_slots
    if (table === 'visit_bookings') return store.visit_bookings
    if (table === 'visit_surveys') return store.visit_surveys
    if (table === 'nurseries') return store.nurseries
    return new Map()
  }
  const builder = {
    select() {
      return builder
    },
    insert(row) {
      state.op = 'insert'
      state.insertRow = Array.isArray(row) ? row : [row]
      return builder
    },
    update(row) {
      state.op = 'update'
      state.updateRow = row
      return builder
    },
    delete() {
      state.op = 'delete'
      state.deleteOp = true
      return builder
    },
    eq(c, v) {
      state.filters.push([c, 'eq', v])
      return builder
    },
    gte(c, v) {
      state.filters.push([c, 'gte', v])
      return builder
    },
    in(c, v) {
      state.filters.push([c, 'in', v])
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
    async _resolve(single, maybe) {
      const m = getMap()
      if (state.op === 'insert') {
        const rows = state.insertRow.map((r) => {
          const id = nextId()
          const row = { id, created_at: new Date().toISOString(), ...r }
          m.set(id, row)
          return row
        })
        return single ? { data: rows[0], error: null } : { data: rows, error: null }
      }
      if (state.op === 'update') {
        const rows = applyFilters([...m.values()])
        const updated = rows.map((r) => {
          const merged = { ...r, ...state.updateRow }
          m.set(r.id, merged)
          return merged
        })
        if (single) return { data: updated[0] ?? null, error: null }
        return { data: updated, error: null }
      }
      if (state.op === 'delete') {
        const rows = applyFilters([...m.values()])
        for (const r of rows) m.delete(r.id)
        return { data: rows, error: null }
      }
      const rows = applyFilters([...m.values()])
      if (single || maybe) return { data: rows[0] ?? null, error: null }
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
        if (token === userToken) return { data: { user: USER }, error: null }
        if (token === ownerToken) return { data: { user: OWNER }, error: null }
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
  renderEnquiryNotificationEmail: vi.fn(() => ({
    subject: 'test',
    html: '<p>test</p>',
    text: 'test',
  })),
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
  idCounter = 0
  store.nurseries.clear()
  store.visit_slots.clear()
  store.visit_bookings.clear()
  store.visit_surveys.clear()
  store.nurseries.set('n-1', {
    id: 'n-1',
    urn: 'EY100',
    name: 'Sunny',
    town: 'London',
    contact_email: null,
    email: null,
    claimed_by_user_id: OWNER.id,
    view_count: 0,
    compare_count: 0,
  })
})

describe('Visit slots and booking', () => {
  it('GET /api/v1/visits/slots/:urn returns empty when no slots', async () => {
    const res = await request(app).get('/api/v1/visits/slots/EY100')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('POST /api/v1/visits/book requires auth', async () => {
    const res = await request(app).post('/api/v1/visits/book').send({})
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/visits/book returns 400 without slot_id', async () => {
    const res = await request(app)
      .post('/api/v1/visits/book')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ nursery_id: 'n-1' })
    expect(res.status).toBe(400)
  })

  it('POST /api/v1/visits/book returns 404 for unknown slot', async () => {
    const res = await request(app)
      .post('/api/v1/visits/book')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ slot_id: 'nonexistent', nursery_id: 'n-1' })
    expect(res.status).toBe(404)
  })

  it('full flow: create slot, book, cancel', async () => {
    // Provider creates a slot
    const createRes = await request(app)
      .post('/api/v1/provider/nurseries/EY100/slots')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ dates: ['2026-06-01'], time: '10:00', duration_min: 30, capacity: 2 })
    expect(createRes.status).toBe(201)
    expect(createRes.body.data.length).toBe(1)
    const slotId = createRes.body.data[0].id

    // Parent books the slot
    const bookRes = await request(app)
      .post('/api/v1/visits/book')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ slot_id: slotId, nursery_id: 'n-1', notes: 'Looking forward' })
    expect(bookRes.status).toBe(201)
    const bookingId = bookRes.body.id

    // Check my visits
    const mineRes = await request(app)
      .get('/api/v1/visits/mine')
      .set('Authorization', `Bearer ${userToken}`)
    expect(mineRes.status).toBe(200)
    expect(mineRes.body.data.length).toBe(1)

    // Cancel
    const cancelRes = await request(app)
      .delete(`/api/v1/visits/${bookingId}`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(cancelRes.status).toBe(200)
    expect(cancelRes.body.status).toBe('cancelled')
  })
})

describe('Visit survey', () => {
  it('POST /api/v1/visits/:id/survey requires auth', async () => {
    const res = await request(app).post('/api/v1/visits/some-id/survey').send({})
    expect(res.status).toBe(401)
  })

  it('returns 404 for non-existent booking', async () => {
    const res = await request(app)
      .post('/api/v1/visits/nonexistent/survey')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ overall_impression: 4 })
    expect(res.status).toBe(404)
  })

  it('submits survey for a booking', async () => {
    // Create slot and booking first
    const slotRes = await request(app)
      .post('/api/v1/provider/nurseries/EY100/slots')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ dates: ['2026-05-01'], time: '10:00' })
    const slotId = slotRes.body.data[0].id

    const bookRes = await request(app)
      .post('/api/v1/visits/book')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ slot_id: slotId, nursery_id: 'n-1' })
    const bookingId = bookRes.body.id

    const surveyRes = await request(app)
      .post(`/api/v1/visits/${bookingId}/survey`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        overall_impression: 5,
        staff_friendliness: 4,
        facilities_quality: 4,
        would_apply: true,
        feedback: 'Great visit!',
      })
    expect(surveyRes.status).toBe(201)
    expect(surveyRes.body.overall_impression).toBe(5)
  })
})

describe('Provider slot management', () => {
  it('rejects slot creation from non-owner', async () => {
    const res = await request(app)
      .post('/api/v1/provider/nurseries/EY100/slots')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ dates: ['2026-06-01'], time: '10:00' })
    expect(res.status).toBe(403)
  })

  it('requires dates array', async () => {
    const res = await request(app)
      .post('/api/v1/provider/nurseries/EY100/slots')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ time: '10:00' })
    expect(res.status).toBe(400)
  })

  it('deletes a slot', async () => {
    const createRes = await request(app)
      .post('/api/v1/provider/nurseries/EY100/slots')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ dates: ['2026-06-01'], time: '10:00' })
    const slotId = createRes.body.data[0].id

    const delRes = await request(app)
      .delete(`/api/v1/provider/nurseries/EY100/slots/${slotId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(delRes.status).toBe(200)
    expect(delRes.body.deleted).toBe(true)
  })
})

describe('View counter', () => {
  it('POST /api/v1/nurseries/:urn/view increments count', async () => {
    const res = await request(app).post('/api/v1/nurseries/EY100/view')
    expect(res.status).toBe(200)
    expect(res.body.counted).toBe(true)
  })

  it('debounces repeat views from same IP', async () => {
    await request(app).post('/api/v1/nurseries/EY100/view')
    const res = await request(app).post('/api/v1/nurseries/EY100/view')
    expect(res.status).toBe(200)
    expect(res.body.counted).toBe(false)
  })
})
