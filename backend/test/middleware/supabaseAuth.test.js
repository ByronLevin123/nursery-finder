// Set env vars BEFORE any imports so createClient runs with them
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// --- Mock data ---

const USERS = {
  'admin-token': { id: 'admin-1', email: 'admin@test.com' },
  'provider-token': { id: 'provider-1', email: 'provider@test.com' },
  'customer-token': { id: 'customer-1', email: 'customer@test.com' },
}

const ROLES = {
  'admin-1': 'admin',
  'provider-1': 'provider',
  'customer-1': 'customer',
}

// --- Mocks ---

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token) => {
        const user = USERS[token]
        if (user) return { data: { user }, error: null }
        return { data: { user: null }, error: { message: 'invalid' } }
      },
    },
  }),
}))

vi.mock('../../src/db.js', () => {
  const mockDb = {
    from: (table) => {
      if (table === 'user_profiles') {
        return {
          select: () => ({
            eq: (col, val) => ({
              maybeSingle: async () => {
                const role = ROLES[val]
                if (role) return { data: { role }, error: null }
                return { data: null, error: null }
              },
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      }
    },
  }
  return { default: mockDb }
})

vi.mock('../../src/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

const { optionalAuth, requireAuth, requireRole } = await import(
  '../../src/middleware/supabaseAuth.js'
)

// --- Helpers ---

function buildApp(middleware, handler) {
  const app = express()
  app.get('/test', middleware, handler || ((req, res) => {
    res.json({ user: req.user || null })
  }))
  return app
}

function buildAppWithRole(roleMw) {
  const app = express()
  app.get('/test', roleMw, (req, res) => {
    res.json({ user: req.user })
  })
  return app
}

// --- Tests ---

describe('optionalAuth', () => {
  it('sets req.user when a valid Bearer token is provided', async () => {
    const app = buildApp(optionalAuth)
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer admin-token')

    expect(res.status).toBe(200)
    expect(res.body.user).toEqual({ id: 'admin-1', email: 'admin@test.com' })
  })

  it('leaves req.user undefined when no token is provided', async () => {
    const app = buildApp(optionalAuth)
    const res = await request(app).get('/test')

    expect(res.status).toBe(200)
    expect(res.body.user).toBeNull()
  })

  it('does not error on an invalid token', async () => {
    const app = buildApp(optionalAuth)
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer bad-token')

    expect(res.status).toBe(200)
    expect(res.body.user).toBeNull()
  })
})

describe('requireAuth', () => {
  it('sets req.user and calls next for a valid token', async () => {
    const app = buildApp(requireAuth)
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer provider-token')

    expect(res.status).toBe(200)
    expect(res.body.user).toEqual({ id: 'provider-1', email: 'provider@test.com' })
  })

  it('returns 401 when no token is provided', async () => {
    const app = buildApp(requireAuth)
    const res = await request(app).get('/test')

    expect(res.status).toBe(401)
    expect(res.body.error).toBeDefined()
  })

  it('returns 401 for an invalid token', async () => {
    const app = buildApp(requireAuth)
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer bad-token')

    expect(res.status).toBe(401)
    expect(res.body.error).toBeDefined()
  })
})

describe('requireRole("admin")', () => {
  it('allows an admin user through', async () => {
    const app = buildAppWithRole(requireRole('admin'))
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer admin-token')

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 'admin-1', role: 'admin' })
  })

  it('returns 403 for a non-admin user', async () => {
    const app = buildAppWithRole(requireRole('admin'))
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer customer-token')

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Forbidden')
  })

  it('returns 401 when no token is provided', async () => {
    const app = buildAppWithRole(requireRole('admin'))
    const res = await request(app).get('/test')

    expect(res.status).toBe(401)
  })
})

describe('requireRole("provider", "admin")', () => {
  it('allows a provider user through', async () => {
    const app = buildAppWithRole(requireRole('provider', 'admin'))
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer provider-token')

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 'provider-1', role: 'provider' })
  })

  it('allows an admin user through', async () => {
    const app = buildAppWithRole(requireRole('provider', 'admin'))
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer admin-token')

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 'admin-1', role: 'admin' })
  })

  it('returns 403 for a customer user', async () => {
    const app = buildAppWithRole(requireRole('provider', 'admin'))
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer customer-token')

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Forbidden')
    expect(res.body.required_role).toEqual(['provider', 'admin'])
  })
})
