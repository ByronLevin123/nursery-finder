import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../src/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

const { errorHandler, notFound } = await import('../../src/middleware/errorHandler.js')

// --- Helpers ---

function buildApp({ throwError, useNotFound } = {}) {
  const app = express()

  if (useNotFound) {
    app.use(notFound)
  } else {
    app.get('/test', (_req, _res, next) => {
      next(throwError)
    })
    app.use(errorHandler)
  }

  return app
}

// --- Tests ---

describe('errorHandler', () => {
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  it('returns 500 with JSON error for unhandled errors', async () => {
    const err = new Error('something broke')
    const app = buildApp({ throwError: err })

    const res = await request(app).get('/test')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('something broke')
    expect(res.body.status).toBe(500)
  })

  it('uses the error status if available', async () => {
    const err = new Error('bad request')
    err.status = 400
    const app = buildApp({ throwError: err })

    const res = await request(app).get('/test')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('bad request')
    expect(res.body.status).toBe(400)
  })

  it('uses statusCode property if status is not set', async () => {
    const err = new Error('not allowed')
    err.statusCode = 403
    const app = buildApp({ throwError: err })

    const res = await request(app).get('/test')

    expect(res.status).toBe(403)
    expect(res.body.status).toBe(403)
  })

  it('hides error message in production mode', async () => {
    process.env.NODE_ENV = 'production'
    const err = new Error('secret database details')
    const app = buildApp({ throwError: err })

    const res = await request(app).get('/test')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Internal server error')
    expect(res.body.error).not.toContain('secret')
  })
})

describe('notFound', () => {
  it('returns 404 with JSON body', async () => {
    const app = buildApp({ useNotFound: true })

    const res = await request(app).get('/anything')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Not found')
    expect(res.body.status).toBe(404)
  })
})
