import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

let app
let request

beforeAll(async () => {
  app = (await import('../src/app.js')).default
  request = (await import('supertest')).default
})

beforeEach(() => {
  vi.restoreAllMocks()
  delete process.env.RESEND_API_KEY
  delete process.env.RESEND_AUDIENCE_ID
})

describe('POST /api/v1/newsletter/subscribe', () => {
  it('rejects an invalid email with 400', async () => {
    const res = await request(app)
      .post('/api/v1/newsletter/subscribe')
      .send({ email: 'not-an-email' })
    expect(res.status).toBe(400)
  })

  it('queues silently when Resend is unconfigured (202)', async () => {
    const res = await request(app)
      .post('/api/v1/newsletter/subscribe')
      .send({ email: 'parent@example.com' })
    expect(res.status).toBe(202)
    expect(res.body.status).toBe('queued')
  })

  it('subscribes via Resend when both env vars are set', async () => {
    process.env.RESEND_API_KEY = 'rk-test'
    process.env.RESEND_AUDIENCE_ID = 'aud-1'
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/audiences/aud-1/contacts')) {
        return new Response(JSON.stringify({ data: { id: 'c1' } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error('unmocked: ' + url)
    })
    const res = await request(app)
      .post('/api/v1/newsletter/subscribe')
      .send({ email: 'parent@example.com' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('subscribed')
  })

  it('returns already_subscribed on duplicate (Resend 422)', async () => {
    process.env.RESEND_API_KEY = 'rk-test'
    process.env.RESEND_AUDIENCE_ID = 'aud-1'
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ name: 'validation_error' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    const res = await request(app)
      .post('/api/v1/newsletter/subscribe')
      .send({ email: 'duplicate@example.com' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('already_subscribed')
  })
})
