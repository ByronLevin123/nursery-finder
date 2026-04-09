import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const OWNER = { id: 'owner-1', email: 'owner@example.com' }
const OTHER = { id: 'other-1', email: 'other@example.com' }
const ownerToken = 'owner-token'
const otherToken = 'other-token'

const store = {
  nurseries: new Map(),
  enquiries: new Map(),
}

function makeQueryBuilder(table) {
  const state = { table, op: 'select', filters: [], insertRow: null, updateRow: null }
  function applyFilters(rows) {
    return rows.filter((r) =>
      state.filters.every(([c, op, v]) => {
        if (op === 'eq') return r[c] === v
        if (op === 'in') return v.includes(r[c])
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
    single() {
      return builder._resolve(true)
    },
    maybeSingle() {
      return builder._resolve(true)
    },
    then(onF, onR) {
      return builder._resolve(false).then(onF, onR)
    },
    async _resolve(single) {
      const m = table === 'nurseries' ? store.nurseries : store.enquiries
      if (state.op === 'update') {
        const rows = applyFilters([...m.values()])
        const updated = rows.map((r) => {
          const merged = { ...r, ...state.updateRow }
          m.set(r.id, merged)
          return merged
        })
        return single ? { data: updated[0] ?? null, error: null } : { data: updated, error: null }
      }
      const rows = applyFilters([...m.values()])
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
  store.nurseries.clear()
  store.enquiries.clear()
  store.nurseries.set('n-1', {
    id: 'n-1',
    urn: 'EY100',
    name: 'Sunny',
    town: 'London',
    contact_email: null,
    email: null,
    claimed_by_user_id: OWNER.id,
  })
  store.enquiries.set('e-1', {
    id: 'e-1',
    nursery_id: 'n-1',
    user_id: 'parent-1',
    child_name: 'Alice',
    status: 'sent',
    sent_at: new Date().toISOString(),
    message: 'Interested',
  })
})

describe('GET /api/v1/provider/enquiries', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/v1/provider/enquiries')
    expect(res.status).toBe(401)
  })

  it('returns enquiries for owned nurseries', async () => {
    const res = await request(app)
      .get('/api/v1/provider/enquiries')
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)
    expect(res.body.data[0].child_name).toBe('Alice')
  })

  it('returns empty for user with no nurseries', async () => {
    const res = await request(app)
      .get('/api/v1/provider/enquiries')
      .set('Authorization', `Bearer ${otherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})

describe('PATCH /api/v1/provider/enquiries/:id', () => {
  it('requires auth', async () => {
    const res = await request(app)
      .patch('/api/v1/provider/enquiries/e-1')
      .send({ status: 'responded' })
    expect(res.status).toBe(401)
  })

  it('updates status for valid transition', async () => {
    const res = await request(app)
      .patch('/api/v1/provider/enquiries/e-1')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'responded' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('responded')
  })

  it('rejects invalid status transition', async () => {
    const res = await request(app)
      .patch('/api/v1/provider/enquiries/e-1')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'accepted' })
    expect(res.status).toBe(400)
  })

  it('rejects non-owner', async () => {
    const res = await request(app)
      .patch('/api/v1/provider/enquiries/e-1')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ status: 'responded' })
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown enquiry', async () => {
    const res = await request(app)
      .patch('/api/v1/provider/enquiries/nonexistent')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'responded' })
    expect(res.status).toBe(404)
  })
})
