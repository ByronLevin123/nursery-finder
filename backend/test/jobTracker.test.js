import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { createMockDb } from './helpers/mockDb.js'

const { db, setTable, getTable } = createMockDb()
vi.mock('../src/db.js', () => ({ default: db }))

// Imported dynamically so the db.js mock is wired before module eval.
let pruneJobRuns

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

beforeAll(async () => {
  ;({ pruneJobRuns } = await import('../src/services/jobTracker.js'))
})

beforeEach(() => {
  setTable('job_runs', [
    { id: 'old-done', job_type: 'geocoding', status: 'completed', started_at: daysAgo(40) },
    { id: 'old-failed', job_type: 'crime_refresh', status: 'failed', started_at: daysAgo(45) },
    { id: 'old-running', job_type: 'land_registry', status: 'running', started_at: daysAgo(50) },
    { id: 'recent-done', job_type: 'geocoding', status: 'completed', started_at: daysAgo(2) },
  ])
})

describe('pruneJobRuns', () => {
  it('deletes terminal runs older than keepDays but keeps recent and running ones', async () => {
    const result = await pruneJobRuns({ keepDays: 30 })

    expect(result.deleted).toBe(2) // old-done + old-failed
    const remaining = getTable('job_runs')
      .map((r) => r.id)
      .sort()
    expect(remaining).toEqual(['old-running', 'recent-done'])
  })

  it('deletes nothing when everything is within the retention window', async () => {
    setTable('job_runs', [{ id: 'a', job_type: 'x', status: 'completed', started_at: daysAgo(1) }])
    const result = await pruneJobRuns({ keepDays: 30 })
    expect(result.deleted).toBe(0)
    expect(getTable('job_runs')).toHaveLength(1)
  })
})
