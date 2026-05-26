import crypto from 'crypto'
import db from '../db.js'

const recentVisitors = new Map()
const DEDUP_MS = 5 * 60 * 1000

setInterval(() => {
  const cutoff = Date.now() - DEDUP_MS
  for (const [key, ts] of recentVisitors) {
    if (ts < cutoff) recentVisitors.delete(key)
  }
}, 60_000)

function hashIp(ip) {
  if (!ip) return null
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

export function visitorTracker(req, res, next) {
  try {
    if (req.method !== 'GET' || !db) return next()
    const ip = req.ip || req.headers?.['x-forwarded-for']
    if (!ip) return next()

    const ipHash = hashIp(ip)
    if (recentVisitors.has(ipHash)) return next()
    recentVisitors.set(ipHash, Date.now())

    db.from('user_activity_log')
      .insert({
        user_id: req.user?.id || null,
        event: 'page_visit',
        metadata: { path: req.originalUrl?.split('?')[0] },
        ip_hash: ipHash,
      })
      .then(() => {})
      .catch(() => {})
  } catch {
    // Never block requests
  }
  return next()
}
