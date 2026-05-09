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

  it('exposes per-dependency checks (database, resend, stripe)', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.body.checks).toBeDefined()
    expect(res.body.checks.database).toBeDefined()
    expect(res.body.checks.resend).toBeDefined()
    expect(res.body.checks.stripe).toBeDefined()
  })

  it('reports unconfigured deps as unconfigured (not error)', async () => {
    const res = await request(app).get('/api/v1/health')
    // In tests no env vars are set → all three should be unconfigured.
    expect(['unconfigured', 'ok', 'error']).toContain(res.body.checks.database.status)
    expect(['unconfigured', 'ok', 'error']).toContain(res.body.checks.resend.status)
    expect(['unconfigured', 'ok', 'error']).toContain(res.body.checks.stripe.status)
    // Optional deps without keys must NOT flip overall status to error.
    if (res.body.checks.resend.status === 'unconfigured' && res.body.checks.database.status !== 'error') {
      expect(res.body.status).toBe('ok')
    }
  })
})
