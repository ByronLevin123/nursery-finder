// Buffer social media scheduling service — lazy-loads when BUFFER_API_TOKEN is set.
// Uses native fetch (Node 20+). All functions return { data, error } pattern.

import { logger } from '../logger.js'

const BUFFER_BASE = 'https://api.bufferapp.com/1'

/**
 * Returns true if Buffer integration is configured.
 */
export function isAvailable() {
  return Boolean(process.env.BUFFER_API_TOKEN)
}

function authParams() {
  return `access_token=${encodeURIComponent(process.env.BUFFER_API_TOKEN)}`
}

/**
 * GET /profiles.json — list all connected social profiles.
 */
export async function getProfiles() {
  if (!isAvailable()) {
    return { data: null, error: 'Buffer is not configured (BUFFER_API_TOKEN missing)' }
  }

  try {
    const res = await fetch(`${BUFFER_BASE}/profiles.json?${authParams()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const body = await res.text()
      logger.warn({ status: res.status, body }, 'buffer getProfiles failed')
      return { data: null, error: `Buffer API error: ${res.status}` }
    }

    const data = await res.json()
    logger.info({ count: Array.isArray(data) ? data.length : 0 }, 'buffer profiles fetched')
    return { data, error: null }
  } catch (err) {
    logger.error({ err: err.message }, 'buffer getProfiles exception')
    return { data: null, error: err.message }
  }
}

/**
 * POST /updates/create.json — schedule or immediately post to Buffer.
 * @param {object} opts
 * @param {string} opts.text - Post content
 * @param {string[]} opts.profileIds - Buffer profile IDs to post to
 * @param {object} [opts.media] - Optional media { link, description, picture }
 * @param {string} [opts.scheduledAt] - ISO timestamp; omit for immediate queue
 */
export async function createPost({ text, profileIds, media, scheduledAt }) {
  if (!isAvailable()) {
    return { data: null, error: 'Buffer is not configured (BUFFER_API_TOKEN missing)' }
  }

  if (!text || !profileIds?.length) {
    return { data: null, error: 'text and profileIds are required' }
  }

  try {
    const body = new URLSearchParams()
    body.append('text', text)
    for (const pid of profileIds) {
      body.append('profile_ids[]', pid)
    }
    if (scheduledAt) {
      body.append('scheduled_at', scheduledAt)
    }
    if (media) {
      if (media.link) body.append('media[link]', media.link)
      if (media.description) body.append('media[description]', media.description)
      if (media.picture) body.append('media[picture]', media.picture)
    }
    body.append('access_token', process.env.BUFFER_API_TOKEN)

    const res = await fetch(`${BUFFER_BASE}/updates/create.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const errBody = await res.text()
      logger.warn({ status: res.status, body: errBody }, 'buffer createPost failed')
      return { data: null, error: `Buffer API error: ${res.status}` }
    }

    const data = await res.json()
    logger.info({ postId: data?.updates?.[0]?.id }, 'buffer post created')
    return { data, error: null }
  } catch (err) {
    logger.error({ err: err.message }, 'buffer createPost exception')
    return { data: null, error: err.message }
  }
}

/**
 * GET /updates/{id}.json — fetch post details + analytics.
 * @param {string} postId - Buffer update ID
 */
export async function getPostAnalytics(postId) {
  if (!isAvailable()) {
    return { data: null, error: 'Buffer is not configured (BUFFER_API_TOKEN missing)' }
  }

  if (!postId) {
    return { data: null, error: 'postId is required' }
  }

  try {
    const res = await fetch(`${BUFFER_BASE}/updates/${encodeURIComponent(postId)}.json?${authParams()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const body = await res.text()
      logger.warn({ status: res.status, postId, body }, 'buffer getPostAnalytics failed')
      return { data: null, error: `Buffer API error: ${res.status}` }
    }

    const data = await res.json()
    return { data, error: null }
  } catch (err) {
    logger.error({ err: err.message, postId }, 'buffer getPostAnalytics exception')
    return { data: null, error: err.message }
  }
}

export default { isAvailable, getProfiles, createPost, getPostAnalytics }
