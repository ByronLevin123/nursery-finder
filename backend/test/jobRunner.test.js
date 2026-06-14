import { describe, it, expect, vi, beforeEach } from 'vitest'

const tracker = vi.hoisted(() => ({
  startJob: vi.fn(async () => 'job-1'),
  completeJob: vi.fn(async () => {}),
  failJob: vi.fn(async () => {}),
}))

vi.mock('../src/services/jobTracker.js', () => tracker)

import { runTrackedJob } from '../src/services/jobRunner.js'

beforeEach(() => {
  vi.clearAllMocks()
  tracker.startJob.mockResolvedValue('job-1')
})

describe('runTrackedJob', () => {
  it('starts then completes a job and returns the result', async () => {
    const result = await runTrackedJob('geocoding', async () => ({ processed: 5 }))

    expect(result).toEqual({ processed: 5 })
    expect(tracker.startJob).toHaveBeenCalledWith('geocoding', null)
    expect(tracker.completeJob).toHaveBeenCalledWith('job-1', { processed: 5 })
    expect(tracker.failJob).not.toHaveBeenCalled()
  })

  it('records a failure and resolves to null when the job throws', async () => {
    const boom = new Error('boom')
    const result = await runTrackedJob('ofsted_sync', async () => {
      throw boom
    })

    expect(result).toBeNull()
    expect(tracker.failJob).toHaveBeenCalledWith('job-1', boom)
    expect(tracker.completeJob).not.toHaveBeenCalled()
  })

  it('coerces an undefined result to a JSON-safe object', async () => {
    await runTrackedJob('visit_reminders', async () => undefined)
    expect(tracker.completeJob).toHaveBeenCalledWith('job-1', { ok: true })
  })

  it('wraps a primitive result', async () => {
    await runTrackedJob('self_check', async () => 42)
    expect(tracker.completeJob).toHaveBeenCalledWith('job-1', { value: 42 })
  })

  it('passes triggeredBy through to startJob', async () => {
    await runTrackedJob('full_cycle', async () => ({}), { triggeredBy: 'user-9' })
    expect(tracker.startJob).toHaveBeenCalledWith('full_cycle', 'user-9')
  })

  it('still runs (and never throws) when the tracker has no db (jobId null)', async () => {
    tracker.startJob.mockResolvedValue(null)
    const result = await runTrackedJob('crime_refresh', async () => ({ processed: 0 }))
    expect(result).toEqual({ processed: 0 })
    expect(tracker.completeJob).toHaveBeenCalledWith(null, { processed: 0 })
  })

  it('throws if fn is not a function (programmer error)', async () => {
    await expect(runTrackedJob('bad', null)).rejects.toThrow(TypeError)
  })
})
