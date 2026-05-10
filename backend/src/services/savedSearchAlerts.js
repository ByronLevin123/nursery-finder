// Saved-search alerts — emails users when new nurseries appear in their saved
// search areas. Runs daily via cron.

import db from '../db.js'
import { logger } from '../logger.js'
import { isEmailAvailable, sendEmail } from './emailService.js'
import { renderSavedSearchAlertEmail } from './emailTemplates.js'
import { geocodePostcode } from './geocoding.js'

const MAX_NURSERIES_PER_SEARCH = 5
const DEFAULT_LOOKBACK_DAYS = 7

// ---------- helpers ----------

async function logEmail({ userId, emailTo, template, subject, resendId }) {
  if (!db) return
  try {
    await db.from('email_log').insert({
      user_id: userId,
      email_to: emailTo,
      template,
      subject,
      status: 'sent',
      resend_id: resendId || null,
    })
  } catch (err) {
    logger.warn({ err: err?.message, template }, 'savedSearchAlerts: email_log insert failed')
  }
}

async function getUserEmail(userId) {
  if (!db) return null
  try {
    const { data } = await db.auth.admin.getUserById(userId)
    return data?.user?.email || null
  } catch {
    return null
  }
}

// ---------- public API ----------

export async function processSavedSearchAlerts() {
  if (!db) {
    logger.warn('savedSearchAlerts: db not configured')
    return { sent: 0, skipped: 0, errors: 0 }
  }

  if (!isEmailAvailable()) {
    logger.warn('savedSearchAlerts: email not configured (no RESEND_API_KEY)')
    return { sent: 0, skipped: 0, errors: 0 }
  }

  // 1. Fetch all saved searches where alert_on_new = true
  const { data: searches, error: searchErr } = await db
    .from('saved_searches')
    .select('*')
    .eq('alert_on_new', true)
    .order('user_id', { ascending: true })

  if (searchErr) {
    logger.error({ err: searchErr.message }, 'savedSearchAlerts: failed to fetch saved searches')
    return { sent: 0, skipped: 0, errors: 1 }
  }

  if (!searches || searches.length === 0) {
    logger.info('savedSearchAlerts: no alert-enabled saved searches')
    return { sent: 0, skipped: 0, errors: 0 }
  }

  // 2. Group by user_id
  const byUser = new Map()
  for (const s of searches) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, [])
    byUser.get(s.user_id).push(s)
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const [userId, userSearches] of byUser) {
    try {
      // 3. Check email_new_nurseries preference
      const { data: profile } = await db
        .from('user_profiles')
        .select('display_name, email_new_nurseries')
        .eq('id', userId)
        .maybeSingle()

      if (profile && profile.email_new_nurseries === false) {
        skipped += userSearches.length
        continue
      }

      // 4. Look up user email
      const email = await getUserEmail(userId)
      if (!email) {
        logger.warn({ userId }, 'savedSearchAlerts: no email found, skipping')
        skipped += userSearches.length
        continue
      }

      const userName = profile?.display_name || null

      // 5. For each saved search, find new nurseries
      const searchResults = [] // { search, nurseries[] }
      const processedSearchIds = []

      for (const search of userSearches) {
        try {
          const postcode = search.postcode || (search.criteria && search.criteria.postcode)
          if (!postcode) {
            skipped++
            continue
          }

          // Geocode the postcode
          let coords
          try {
            coords = await geocodePostcode(postcode)
          } catch (geoErr) {
            logger.warn(
              { err: geoErr?.message, postcode, searchId: search.id },
              'savedSearchAlerts: geocode failed'
            )
            skipped++
            continue
          }

          const radiusKm = search.radius_km || (search.criteria && search.criteria.radius_km) || 5
          const gradeFilter =
            search.grade_filter || (search.criteria && search.criteria.grade_filter) || null

          // Query nurseries near this search
          const { data: nurseries, error: nursErr } = await db.rpc('search_nurseries_near', {
            search_lat: coords.lat,
            search_lng: coords.lng,
            radius_km: radiusKm,
            grade_filter: gradeFilter,
            funded_2yr: false,
            funded_3yr: false,
          })

          if (nursErr) {
            logger.warn(
              { err: nursErr.message, searchId: search.id },
              'savedSearchAlerts: nursery search failed'
            )
            errors++
            continue
          }

          // Filter to only nurseries created since last_alerted_at (or last N days)
          const since = search.last_alerted_at
            ? new Date(search.last_alerted_at)
            : new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

          // The search RPC does not return created_at, so we need a separate query
          // for the URNs that came back, filtering by created_at.
          if (!nurseries || nurseries.length === 0) {
            processedSearchIds.push(search.id)
            continue
          }

          const urns = nurseries.map((n) => n.urn).filter(Boolean)
          if (urns.length === 0) {
            processedSearchIds.push(search.id)
            continue
          }

          const { data: newNurseries, error: newErr } = await db
            .from('nurseries')
            .select('urn, name, ofsted_overall_grade, town, postcode')
            .in('urn', urns)
            .gte('created_at', since.toISOString())
            .order('created_at', { ascending: false })
            .limit(MAX_NURSERIES_PER_SEARCH)

          if (newErr) {
            logger.warn(
              { err: newErr.message, searchId: search.id },
              'savedSearchAlerts: new nursery filter failed'
            )
            errors++
            continue
          }

          if (newNurseries && newNurseries.length > 0) {
            searchResults.push({
              search,
              nurseries: newNurseries,
            })
          }

          processedSearchIds.push(search.id)
        } catch (searchError) {
          logger.error(
            { err: searchError?.message, searchId: search.id },
            'savedSearchAlerts: search processing failed'
          )
          errors++
        }
      }

      // 6. If no new nurseries found for any search, skip email but still update timestamps
      if (searchResults.length === 0) {
        // Update last_alerted_at even when there are no results so we don't re-check the same window
        if (processedSearchIds.length > 0) {
          await db
            .from('saved_searches')
            .update({ last_alerted_at: new Date().toISOString() })
            .in('id', processedSearchIds)
        }
        skipped++
        continue
      }

      // 7. Render and send email
      const rendered = renderSavedSearchAlertEmail({
        userName,
        searchResults,
      })

      const result = await sendEmail({
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      })

      await logEmail({
        userId,
        emailTo: email,
        template: 'saved_search_alert',
        subject: rendered.subject,
        resendId: result?.messageId,
      })

      // 8. Update last_alerted_at on all processed searches
      if (processedSearchIds.length > 0) {
        await db
          .from('saved_searches')
          .update({ last_alerted_at: new Date().toISOString() })
          .in('id', processedSearchIds)
      }

      sent++
    } catch (err) {
      logger.error({ err: err?.message, userId }, 'savedSearchAlerts: user processing failed')
      errors++
    }
  }

  logger.info({ sent, skipped, errors, totalUsers: byUser.size }, 'savedSearchAlerts: complete')
  return { sent, skipped, errors }
}

export default { processSavedSearchAlerts }
