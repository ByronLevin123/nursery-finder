import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('../src/db.js', () => ({ default: null }))

let app
beforeAll(async () => {
  app = (await import('../src/app.js')).default
})

const request = (await import('supertest')).default

describe('GET /api/v1/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
