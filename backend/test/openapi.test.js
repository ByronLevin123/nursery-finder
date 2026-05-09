import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('../src/db.js', () => ({ default: null }))

let app
let openapi
beforeAll(async () => {
  app = (await import('../src/app.js')).default
  openapi = (await import('../src/openapi.js')).default
})

const request = (await import('supertest')).default

describe('OpenAPI spec', () => {
  it('is valid OpenAPI 3.1 with required info fields', () => {
    expect(openapi.openapi).toBe('3.1.0')
    expect(openapi.info.title).toBe('NurseryMatch Public API')
    expect(openapi.info.version).toBe('1.0.0')
    expect(openapi.info.license.name).toBe('MIT')
    expect(Array.isArray(openapi.servers)).toBe(true)
    expect(openapi.servers[0].url).toMatch(/onrender\.com/)
  })

  it('declares all required public read paths', () => {
    const required = [
      '/api/v1/nurseries/search',
      '/api/v1/nurseries/{urn}',
      '/api/v1/areas/{district}',
      '/api/v1/areas/family-search',
      '/api/v1/areas/{district}/nurseries',
      '/api/v1/properties/districts',
      '/api/v1/overlays/schools/near',
      '/api/v1/public/nursery/{urn}.md',
      '/api/v1/public/area/{district}.md',
    ]
    for (const p of required) {
      expect(openapi.paths[p], `missing path ${p}`).toBeDefined()
    }
  })

  it('every path has a success response (2xx)', () => {
    for (const [pathKey, methods] of Object.entries(openapi.paths)) {
      for (const op of Object.values(methods)) {
        const codes = Object.keys(op.responses || {})
        const hasSuccess = codes.some((c) => c.startsWith('2'))
        expect(hasSuccess, `${pathKey} missing 2xx response`).toBe(true)
      }
    }
  })

  it('exposes /api/openapi.json over HTTP', async () => {
    const res = await request(app).get('/api/openapi.json')
    expect(res.status).toBe(200)
    expect(res.body.openapi).toBe('3.1.0')
    expect(res.body.paths['/api/v1/nurseries/{urn}']).toBeDefined()
  })
})
