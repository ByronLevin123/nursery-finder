// Tests for the mediated login route + email-keyed lockout.
// Mocks Supabase's REST endpoint via global fetch so we can simulate
// success / auth-failure responses.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

let app
let request
let resetLockout

const SUPABASE_URL = 'https://example.supabase.co'

beforeAll(async () => {
  process.env.SUPABASE_URL = SUPABASE_URL
  process.env.SUPABASE_ANON_KEY = 'test-anon-key'
  app = (await import('../src/app.js')).default
  request = (await import('supertest')).default
  resetLockout = (await import('../src/routes/auth.js'))._resetLoginLockoutStateForTests
})

beforeEach(() => {
  resetLockout()
  vi.restoreAllMocks()
})

function mockSupabase(status, body) {
  // Stub global fetch — only intercept Supabase auth endpoint, pass through others.
  vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
    if (typeof url === 'string' && url.startsWith(`${SUPABASE_URL}/auth/v1/token`)) {
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new Error(`Unmocked fetch: ${url}`)
  })
}

describe('POST /api/v1/auth/login', () => {
  it('returns 400 if email or password missing', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({})
    expect(res.status).toBe(400)
  })

  it('proxies a successful login from Supabase', async () => {
    mockSupabase(200, {
      access_token: 'at-123',
      refresh_token: 'rt-123',
      user: { id: 'u1', email: 'a@b.com' },
    })
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'right-password' })
    expect(res.status).toBe(200)
    expect(res.body.access_token).toBe('at-123')
    expect(res.body.user.email).toBe('a@b.com')
  })

  it('returns 401 on auth failure with attempts_remaining', async () => {
    mockSupabase(400, {
      error: 'invalid_grant',
      error_description: 'Invalid login credentials',
    })
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'wrong' })
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('invalid_grant')
    expect(res.body.attempts_remaining).toBe(4)
  })

  it('locks the account after 5 failed attempts and returns 429 thereafter', async () => {
    mockSupabase(400, { error_description: 'bad' })
    const email = 'lock@me.com'
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post('/api/v1/auth/login').send({ email, password: 'x' })
      expect(r.status).toBe(401)
    }
    const sixth = await request(app).post('/api/v1/auth/login').send({ email, password: 'x' })
    expect(sixth.status).toBe(429)
    expect(sixth.body.code).toBe('login_lockout')
    expect(sixth.body.retry_after_seconds).toBeGreaterThan(0)
  })

  it('lockout is per-email (case-insensitive), not per-password attempt', async () => {
    mockSupabase(400, { error_description: 'bad' })
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/v1/auth/login').send({ email: 'A@B.com', password: 'x' })
    }
    // Same email lower-cased should be locked
    const r = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'x' })
    expect(r.status).toBe(429)
    // Different email is independent
    const r2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'c@d.com', password: 'x' })
    expect(r2.status).toBe(401) // only one failure, not locked
  })

  it('successful login clears prior failure counter', async () => {
    // 4 failures
    mockSupabase(400, { error_description: 'bad' })
    for (let i = 0; i < 4; i++) {
      await request(app).post('/api/v1/auth/login').send({ email: 'a@b.com', password: 'x' })
    }
    // Now succeed
    mockSupabase(200, {
      access_token: 'at',
      refresh_token: 'rt',
      user: { id: 'u1', email: 'a@b.com' },
    })
    const ok = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'right' })
    expect(ok.status).toBe(200)
    // Subsequent failures restart the counter
    mockSupabase(400, { error_description: 'bad' })
    const fail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'x' })
    expect(fail.body.attempts_remaining).toBe(4)
  })
})

describe('GET /api/v1/auth/lockout', () => {
  it('returns unlocked state for an unknown email', async () => {
    const res = await request(app).get('/api/v1/auth/lockout').query({ email: 'fresh@a.com' })
    expect(res.status).toBe(200)
    expect(res.body.locked).toBe(false)
    expect(res.body.remaining).toBe(5)
  })

  it('reflects lockout state after failures', async () => {
    mockSupabase(400, { error_description: 'bad' })
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/v1/auth/login').send({ email: 'q@a.com', password: 'x' })
    }
    const res = await request(app).get('/api/v1/auth/lockout').query({ email: 'q@a.com' })
    expect(res.body.locked).toBe(true)
    expect(res.body.retry_after_seconds).toBeGreaterThan(0)
  })
})
