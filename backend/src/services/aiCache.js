// Read/write helpers for the ai_content_cache table.
// Returns null on miss, expired entries, or any DB failure (graceful).

import db from '../db.js'
import { logger } from '../logger.js'

export async function getCached(cacheKey) {
  if (!db) return null
  try {
    const { data, error } = await db
      .from('ai_content_cache')
      .select('content, metadata, created_at, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle()
    if (error || !data) return null
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return null
    }
    return data
  } catch (err) {
    logger.warn({ err: err.message, cacheKey }, 'ai cache read failed')
    return null
  }
}

export async function setCached(cacheKey, content, { ttlDays = 30, metadata = {} } = {}) {
  if (!db) return
  try {
    const expires_at = ttlDays
      ? new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString()
      : null
    await db.from('ai_content_cache').upsert(
      {
        cache_key: cacheKey,
        content,
        metadata,
        created_at: new Date().toISOString(),
        expires_at,
      },
      { onConflict: 'cache_key' }
    )
  } catch (err) {
    logger.warn({ err: err.message, cacheKey }, 'ai cache write failed')
  }
}
