// Daily digest job — for every saved_search, find new districts that match the
// stored criteria since last_notified_at and email the user a digest.
// Designed to be invoked from worker.js (cron) or manually.

import db from '../db.js'
import { logger } from '../logger.js'
import { isEmailAvailable, sendEmail, renderDigestEmail } from './emailService.js'

const FIRST_RUN_LIMIT = 5

async function findMatchesForCriteria(criteria, sinceIso) {
  if (!db) return []
  // Best-effort match: rank postcode_areas by family_score, optionally
  // applying minimum filters from the criteria.
  const minFamily = (criteria && (criteria.min_family_score || criteria.minFamilyScore)) || 0
  let q = db
    .from('postcode_areas')
    .select('postcode_district,family_score,nursery_outstanding_pct,updated_at')
    .order('family_score', { ascending: false })
    .limit(20)
  if (minFamily) q = q.gte('family_score', minFamily)
  if (sinceIso) q = q.gte('updated_at', sinceIso)
  const { data, error } = await q
  if (error) {
    logger.warn({ err: error.message }, 'digest: postcode_areas query failed')
    return []
  }
  return data || []
}

export async function runDailyDigest() {
  if (!db) {
    logger.warn('digest: database not configured, skipping')
    return { users: 0, emailsSent: 0 }
  }
  if (!isEmailAvailable()) {
    logger.warn('digest: email not configured, skipping')
    return { users: 0, emailsSent: 0 }
  }

  const { data: searches, error } = await db
    .from('saved_searches')
    .select('id,user_id,name,criteria,last_notified_at')
  if (error) {
    logger.error({ err: error.message }, 'digest: failed to load saved_searches')
    return { users: 0, emailsSent: 0 }
  }

  // Group by user
  const byUser = new Map()
  for (const s of searches || []) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, [])
    byUser.get(s.user_id).push(s)
  }

  let emailsSent = 0
  for (const [userId, userSearches] of byUser) {
    try {
      // Look up email via auth.users (service key required)
      let email = null
      try {
        const { data: userData } = await db.auth.admin.getUserById(userId)
        email = userData?.user?.email || null
      } catch {
        email = null
      }
      if (!email) {
        logger.info({ userId }, 'digest: skipping user with no email')
        continue
      }

      const newMatches = {}
      let totalNew = 0
      for (const s of userSearches) {
        const sinceIso = s.last_notified_at || null
        let matches = await findMatchesForCriteria(s.criteria || {}, sinceIso)
        if (!sinceIso) matches = matches.slice(0, FIRST_RUN_LIMIT)
        newMatches[s.id] = matches
        totalNew += matches.length
      }

      if (totalNew === 0) {
        logger.info({ userId }, 'digest: no new matches, skipping email')
        continue
      }

      const { subject, html, text } = renderDigestEmail({
        savedSearches: userSearches,
        newMatches,
        userName: email.split('@')[0],
      })
      await sendEmail({ to: email, subject, html, text })
      emailsSent += 1

      // Update last_notified_at on all this user's searches
      const nowIso = new Date().toISOString()
      const ids = userSearches.map((s) => s.id)
      const { error: updErr } = await db
        .from('saved_searches')
        .update({ last_notified_at: nowIso })
        .in('id', ids)
      if (updErr) {
        logger.warn({ err: updErr.message, userId }, 'digest: failed to update last_notified_at')
      }
    } catch (err) {
      logger.error({ err: err?.message, userId }, 'digest: user batch failed')
    }
  }

  logger.info({ users: byUser.size, emailsSent }, 'digest: complete')
  return { users: byUser.size, emailsSent }
}

export default { runDailyDigest }
