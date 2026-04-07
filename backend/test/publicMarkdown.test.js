import { describe, it, expect, vi, beforeAll } from 'vitest'

const nurseryRow = {
  urn: 'EY123',
  name: 'Sunshine Day Nursery',
  address_line1: '1 Test Lane',
  town: 'London',
  postcode: 'SW11 1AA',
  local_authority: 'Wandsworth',
  ofsted_overall_grade: 'Outstanding',
  last_inspection_date: '2024-01-15',
  inspection_report_url: 'https://reports.ofsted.gov.uk/EY123',
  enforcement_notice: false,
  total_places: 60,
  places_funded_2yr: 6,
  places_funded_3_4yr: 24,
  fee_avg_monthly: 1450,
  fee_report_count: 5,
  description: 'A friendly nursery in Battersea.',
  phone: '020 1234 5678',
  email: 'hi@example.com',
  website: 'https://example.com',
}

const areaRow = {
  postcode_district: 'SW11',
  local_authority: 'Wandsworth',
  family_score: 78,
  nursery_count_total: 42,
  nursery_count_outstanding: 9,
  nursery_count_good: 28,
  nursery_outstanding_pct: 21,
  avg_sale_price_all: 850000,
  avg_sale_price_flat: 600000,
  avg_sale_price_terraced: 1100000,
  avg_sale_price_semi: 1400000,
  avg_sale_price_detached: 2200000,
  gross_yield_pct: 3.2,
  price_growth_1yr_pct: 2.1,
  crime_rate_per_1000: 84,
  imd_decile: 7,
  flood_risk_level: 'low',
  nearest_park_name: 'Battersea Park',
  nearest_park_distance_m: 320,
  park_count_within_1km: 4,
}

const topNurseries = [
  { urn: 'EY1', name: 'Alpha', ofsted_overall_grade: 'Outstanding', postcode: 'SW11 1AB' },
  { urn: 'EY2', name: 'Beta', ofsted_overall_grade: 'Good', postcode: 'SW11 1AC' },
]

vi.mock('../src/db.js', () => {
  function buildNurseryQuery() {
    const q = {
      select: () => q,
      eq: () => q,
      like: () => q,
      order: () => q,
      limit: () => Promise.resolve({ data: topNurseries, error: null }),
      maybeSingle: () => Promise.resolve({ data: nurseryRow, error: null }),
    }
    return q
  }
  function buildAreaQuery() {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: () => Promise.resolve({ data: areaRow, error: null }),
    }
    return q
  }
  return {
    default: {
      from: (table) => (table === 'postcode_areas' ? buildAreaQuery() : buildNurseryQuery()),
    },
  }
})

let app
beforeAll(async () => {
  app = (await import('../src/app.js')).default
})

const request = (await import('supertest')).default

describe('Public markdown endpoints', () => {
  it('returns nursery markdown with name and address', async () => {
    const res = await request(app).get('/api/v1/public/nursery/EY123.md')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/markdown/)
    expect(res.text).toContain('Sunshine Day Nursery')
    expect(res.text).toContain('1 Test Lane')
    expect(res.text).toContain('SW11 1AA')
    expect(res.text).toContain('Outstanding')
  })

  it('returns area markdown with district stats', async () => {
    const res = await request(app).get('/api/v1/public/area/SW11.md')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/markdown/)
    expect(res.text).toContain('SW11')
    expect(res.text).toContain('Wandsworth')
    expect(res.text).toContain('Family score')
    expect(res.text).toContain('Battersea Park')
  })

  it('cites Ofsted as the source on nursery markdown', async () => {
    const res = await request(app).get('/api/v1/public/nursery/EY123.md')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Ofsted')
  })
})
