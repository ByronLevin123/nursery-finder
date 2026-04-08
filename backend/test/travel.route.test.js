import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('../src/db.js', () => ({ default: null }))

vi.mock('../src/services/travelTime.js', () => ({
  getTravelTime: vi.fn(async ({ mode }) => ({
    duration_s: 600,
    distance_m: 1200,
    mode,
    cached: false,
  })),
  getTravelMatrix: vi.fn(async ({ to }) =>
    to.map((_, i) => ({ duration_s: 300 + i * 60, distance_m: 500 + i * 100 }))
  ),
}))

vi.mock('../src/services/geocoding.js', () => ({
  geocodePostcode: vi.fn(async () => ({ lat: 51.5, lng: -0.1 })),
  chunkPostcodes: vi.fn(),
  geocodeNurseriesBatch: vi.fn(),
}))

let app
beforeAll(async () => {
  app = (await import('../src/app.js')).default
})

const request = (await import('supertest')).default

describe('POST /api/v1/travel/time', () => {
  it('returns travel time for lat/lng input', async () => {
    const res = await request(app)
      .post('/api/v1/travel/time')
      .send({
        from: { lat: 51.5, lng: -0.1 },
        to: { lat: 51.6, lng: -0.05 },
        mode: 'walk',
      })
    expect(res.status).toBe(200)
    expect(res.body.duration_s).toBe(600)
    expect(res.body.mode).toBe('walk')
  })

  it('accepts postcode endpoints', async () => {
    const res = await request(app)
      .post('/api/v1/travel/time')
      .send({
        from: { postcode: 'SW11 1AA' },
        to: { postcode: 'EC1A 1BB' },
        mode: 'drive',
      })
    expect(res.status).toBe(200)
    expect(res.body.duration_s).toBe(600)
  })

  it('rejects unknown mode', async () => {
    const res = await request(app)
      .post('/api/v1/travel/time')
      .send({
        from: { lat: 51.5, lng: -0.1 },
        to: { lat: 51.6, lng: -0.05 },
        mode: 'teleport',
      })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/v1/travel/isochrone', () => {
  it('returns a FeatureCollection with polygons', async () => {
    const res = await request(app)
      .post('/api/v1/travel/isochrone')
      .send({
        from: { lat: 51.5, lng: -0.1 },
        durations_min: [15, 30],
        mode: 'drive',
      })
    expect(res.status).toBe(200)
    expect(res.body.type).toBe('FeatureCollection')
    expect(Array.isArray(res.body.features)).toBe(true)
  })
})
