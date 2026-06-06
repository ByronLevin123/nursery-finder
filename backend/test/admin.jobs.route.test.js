import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// supabaseAuth.js reads these at module load.
process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_ANON_KEY = 'anon-test-key'

import { createMockDb } from './helpers/mockDb.js'
import { createAuthMock } from './helpers/testApp.js'

const { db, setTable, resetAll } = createMockDb({
  user_profiles: [
    { id: 'admin-1', role: 'admin' },
    { id: 'user-1', role: 'customer' },
  ],
})
vi.mock('../src/db.js', () => ({ default: db }))

const { supabaseMock } = createAuthMock({
  'admin-token': { id: 'admin-1', email: 'admin@example.com' },
  'user-token': { id: 'user-1', email: 'user@example.com' },
})
vi.mock('@supabase/supabase-js', () => supabaseMock)

let app
let request

beforeAll(async () => {
  app = (await import('../src/app.js')).default
  request = (await import('supertest')).default
})

beforeEach(() => {
  resetAll({
    user_profiles: [
      { id: 'admin-1', role: 'admin' },
      { id: 'user-1', role: 'customer' },
    ],
  })
})

const asAdmin = (req) => req.set('Authorization', 'Bearer admin-token')

describe('GET /api/v1/admin/jobs/summary', () => {
  it('rejects non-admins with 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/jobs/summary')
      .set('Authorization', 'Bearer user-token')
    expect(res.status).toBe(403)
  })

  it('returns the latest run per job_type with a health flag', async () => {
    const newer = '2026-06-06T05:00:00.000Z'
    const older = '2026-06-05T05:00:00.000Z'
    setTable('job_runs', [
      { id: '1', job_type: 'geocoding', status: 'failed', started_at: older },
      { id: '2', job_type: 'geocoding', status: 'completed', started_at: newer },
      { id: '3', job_type: 'crime_refresh', status: 'failed', started_at: newer },
    ])

    const res = await asAdmin(request(app).get('/api/v1/admin/jobs/summary'))
    expect(res.status).toBe(200)

    const byType = Object.fromEntries(res.body.data.map((r) => [r.job_type, r]))
    // geocoding's latest run is the completed one → healthy
    expect(byType.geocoding.status).toBe('completed')
    expect(byType.geocoding.healthy).toBe(true)
    // crime_refresh's latest run failed → unhealthy
    expect(byType.crime_refresh.status).toBe('failed')
    expect(byType.crime_refresh.healthy).toBe(false)
  })

  it('returns an empty list when there are no runs', async () => {
    setTable('job_runs', [])
    const res = await asAdmin(request(app).get('/api/v1/admin/jobs/summary'))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})
