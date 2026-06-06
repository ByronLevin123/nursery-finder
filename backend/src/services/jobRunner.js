// jobRunner — wraps a cron job with job_runs tracking (via jobTracker) and
// structured logging so scheduled jobs show up in the admin Jobs panel.
//
// runTrackedJob never throws: it is designed to be called directly from a cron
// callback, so a failing job records a 'failed' run but can never crash the
// long-running worker process.

import { startJob, completeJob, failJob } from './jobTracker.js'
import { logger } from '../logger.js'

// Coerce a job's return value into something safe to store in job_runs.result
// (a JSONB column). Plain objects pass through; primitives are wrapped.
function toResult(value) {
  if (value === undefined || value === null) return { ok: true }
  if (typeof value === 'object') return value
  return { value }
}

/**
 * Run a job function wrapped with job_runs tracking and logging.
 * @param {string} jobType - identifier stored in job_runs.job_type
 * @param {() => Promise<any>} fn - the job to run
 * @param {object} [opts]
 * @param {string|null} [opts.triggeredBy] - user id for manual triggers (null for cron)
 * @returns {Promise<any|null>} the job result, or null if it threw
 */
export async function runTrackedJob(jobType, fn, { triggeredBy = null } = {}) {
  if (typeof fn !== 'function') {
    throw new TypeError('runTrackedJob: fn must be a function')
  }

  logger.info({ jobType }, 'cron: job starting')
  const jobId = await startJob(jobType, triggeredBy)

  try {
    const result = await fn()
    const stored = toResult(result)
    await completeJob(jobId, stored)
    logger.info({ jobType, result: stored }, 'cron: job complete')
    return result
  } catch (err) {
    await failJob(jobId, err)
    logger.error({ jobType, err: err?.message }, 'cron: job failed')
    return null
  }
}

export default { runTrackedJob }
