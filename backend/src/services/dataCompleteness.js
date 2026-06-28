// Data completeness scoring — computes data_completeness_pct for each nursery.
//
// Each field contributes a fixed number of points towards 100%.
// Run nightly after dimension scores to keep the value fresh.

import db from '../db.js'
import { logger } from '../logger.js'

const BATCH_SIZE = 500

/**
 * Compute the data completeness percentage for a single nursery row.
 * Returns a number 0–100.
 */
export function computeCompleteness(nursery) {
  let score = 0

  // Has Ofsted grade: +15
  if (nursery.ofsted_overall_grade) score += 15

  // Has registered_date: +5
  if (nursery.registered_date) score += 5

  // Has fee data (fee_avg_monthly > 0): +15
  if (nursery.fee_avg_monthly && nursery.fee_avg_monthly > 0) score += 15

  // Has reviews (review_count > 0): +10
  if (nursery.review_count && nursery.review_count > 0) score += 10

  // Has Google rating: +10
  if (nursery.google_rating && nursery.google_rating > 0) score += 10

  // Has photos (photos array not empty): +10
  if (nursery.photos && Array.isArray(nursery.photos) && nursery.photos.length > 0) score += 10

  // Has opening_hours (not null): +10
  if (nursery.opening_hours) score += 10

  // Has description (not empty): +5
  if (nursery.description && nursery.description.trim().length > 0) score += 5

  // Has contact info (phone or email): +5
  if (
    (nursery.phone && nursery.phone.trim().length > 0) ||
    (nursery.email && nursery.email.trim().length > 0)
  ) {
    score += 5
  }

  // Has location (lat/lng): +10
  if (nursery.lat != null && nursery.lng != null) score += 10

  // Has staff data: +5
  if (nursery.staff_count && nursery.staff_count > 0) score += 5

  return Math.min(100, score)
}

/**
 * Re-compute data_completeness_pct for all active nurseries.
 * Processes in batches to avoid memory pressure.
 */
export async function computeAllDataCompleteness() {
  if (!db) throw new Error('Database not configured')

  logger.info('data-completeness: starting computation')
  const startTime = Date.now()

  let processed = 0
  let updated = 0
  let errors = 0
  let offset = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const { data: nurseries, error: fetchErr } = await db
        .from('nurseries')
        .select(
          'id, ofsted_overall_grade, registered_date, fee_avg_monthly, review_count, ' +
          'google_rating, photos, opening_hours, description, phone, email, lat, lng, ' +
          'staff_count, data_completeness_pct'
        )
        .eq('registration_status', 'Active')
        .range(offset, offset + BATCH_SIZE - 1)

      if (fetchErr) {
        logger.error({ error: fetchErr.message }, 'data-completeness: fetch failed')
        errors++
        break
      }

      if (!nurseries || nurseries.length === 0) break

      // Build updates — only update rows where the score has changed
      const updates = []
      for (const nursery of nurseries) {
        const newPct = computeCompleteness(nursery)
        if (newPct !== nursery.data_completeness_pct) {
          updates.push({ id: nursery.id, pct: newPct })
        }
      }

      // Apply updates in smaller sub-batches
      for (const { id, pct } of updates) {
        try {
          const { error: upErr } = await db
            .from('nurseries')
            .update({ data_completeness_pct: pct })
            .eq('id', id)

          if (upErr) {
            errors++
          } else {
            updated++
          }
        } catch (err) {
          errors++
          logger.warn({ id, err: err.message }, 'data-completeness: update failed')
        }
      }

      processed += nurseries.length
      offset += BATCH_SIZE

      if (processed % 2000 === 0) {
        logger.info({ processed, updated, errors }, 'data-completeness: progress')
      }

      // If we got fewer than BATCH_SIZE, we've reached the end
      if (nurseries.length < BATCH_SIZE) break
    } catch (err) {
      logger.error({ err: err.message, offset }, 'data-completeness: batch failed')
      errors++
      break
    }
  }

  const duration = Date.now() - startTime
  const result = { processed, updated, errors, duration_ms: duration }
  logger.info(result, 'data-completeness: computation complete')
  return result
}
