import crypto from 'crypto'
import db from '../db.js'
import { logger } from '../logger.js'

function hashIp(ip) {
  if (!ip) return null
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

export function trackActivity(userId, event, { targetUrn, metadata, req } = {}) {
  try {
    if (!db || typeof db.from !== 'function') return
    const ipHash = req ? hashIp(req.ip || req.headers?.['x-forwarded-for']) : null

    db.from('user_activity_log')
      .insert({
        user_id: userId || null,
        event,
        target_urn: targetUrn || null,
        metadata: metadata || {},
        ip_hash: ipHash,
      })
      .then(({ error }) => {
        if (error) logger.warn({ event, err: error.message }, 'activity track failed')
      })
      .catch(() => {})
  } catch {
    // Never let tracking break the request
  }
}
