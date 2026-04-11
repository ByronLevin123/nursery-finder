/**
 * Shared test app factory for route tests.
 *
 * Usage:
 *   import { createTestApp } from './helpers/testApp.js'
 *   const app = createTestApp(router, { prefix: '/api/v1/nurseries' })
 *   const res = await request(app).get('/api/v1/nurseries/123')
 */

import express from 'express'

export function createTestApp(router, { prefix = '/api/v1' } = {}) {
  const app = express()
  app.use(express.json())
  app.use(prefix, router)

  // Error handler matching production pattern
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500
    res.status(status).json({
      error: err.message || 'Internal Server Error',
    })
  })

  return app
}

/**
 * Creates a mock for @supabase/supabase-js that wires up auth.getUser
 * to validate tokens against a user map.
 *
 * Usage:
 *   const { supabaseMock, addUser } = createAuthMock({
 *     'valid-token': { id: 'user-1', email: 'test@test.com' }
 *   })
 *   vi.mock('@supabase/supabase-js', () => supabaseMock)
 *
 * For role-based auth, also seed the db's user_profiles table:
 *   setTable('user_profiles', [{ id: 'user-1', role: 'admin' }])
 */
export function createAuthMock(usersByToken = {}) {
  const tokenMap = { ...usersByToken }

  function addUser(token, user) {
    tokenMap[token] = user
  }

  const supabaseMock = {
    createClient: () => ({
      auth: {
        getUser: async (token) => {
          const user = tokenMap[token]
          if (user) return { data: { user }, error: null }
          return { data: { user: null }, error: { message: 'invalid token' } }
        },
      },
    }),
  }

  return { supabaseMock, addUser }
}
