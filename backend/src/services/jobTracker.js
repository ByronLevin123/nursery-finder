import db from '../db.js'
import { logger } from '../logger.js'

export async function startJob(jobType, triggeredBy) {
  if (!db) return null
  try {
    const { data } = await db
      .from('job_runs')
      .insert({
        job_type: jobType,
        status: 'running',
        triggered_by: triggeredBy || null,
      })
      .select('id')
      .single()
    return data?.id || null
  } catch (err) {
    logger.warn({ err: err.message }, 'jobTracker: failed to create job run')
    return null
  }
}

export async function updateJobProgress(jobId, result) {
  if (!db || !jobId) return
  try {
    await db
      .from('job_runs')
      .update({ result })
      .eq('id', jobId)
  } catch (err) {
    logger.warn({ err: err.message }, 'jobTracker: failed to update job progress')
  }
}

export async function completeJob(jobId, result) {
  if (!db || !jobId) return
  try {
    await db
      .from('job_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result,
      })
      .eq('id', jobId)
  } catch (err) {
    logger.warn({ err: err.message }, 'jobTracker: failed to update job run')
  }
}

export async function failJob(jobId, error) {
  if (!db || !jobId) return
  try {
    await db
      .from('job_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        result: { error: typeof error === 'string' ? error : error?.message || 'Unknown error' },
      })
      .eq('id', jobId)
  } catch (err) {
    logger.warn({ err: err.message }, 'jobTracker: failed to update job run')
  }
}
