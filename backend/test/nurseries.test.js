import { describe, it, expect, vi, beforeAll } from 'vitest'

const mockRpc = vi.fn(async () => ({
  data: [
    { urn: 'EY1', name: 'Test Nursery', distance_km: 0.5 },
    { urn: 'EY2', name: 'Other Nursery', distance_km: 1.2 },
  ],
  error: null,
}))

vi.mock('../src/db.js', () => ({
  default: {
    rpc: (...args) => mockRpc(...args),
  },
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
beforeAll(async () => {
  app = (await import('../src/app.js')).default
})

const request = (await import('supertest')).default

describe('POST /api/v1/nurseries/search', () => {
  it('returns nurseries for a valid postcode', async () => {
    const res = await request(app)
      .post('/api/v1/nurseries/search')
      .send({ postcode: 'SW1A 1AA', radius_km: 5 })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('meta')
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.meta.total).toBe(2)
  })

  it('returns 400 when postcode is missing', async () => {
    const res = await request(app).post('/api/v1/nurseries/search').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/postcode/i)
  })

  it('returns 400 for invalid postcode format', async () => {
    const res = await request(app)
      .post('/api/v1/nurseries/search')
      .send({ postcode: 'NOT-A-POSTCODE' })
    expect(res.status).toBe(400)
  })
})
