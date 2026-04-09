// Scoring engine — recomputes dimension scores for all nurseries nightly.

import db from '../db.js'
import { logger } from '../logger.js'

const BATCH_SIZE = 500

const GRADE_SCORES = {
  Outstanding: 95,
  Good: 70,
  'Requires improvement': 35,
  Inadequate: 10,
}

/**
 * Compute quality_score from Ofsted grade + inspection age + enforcement.
 */
export function computeQualityScore(nursery) {
  const grade = nursery.ofsted_overall_grade
  if (!grade || !GRADE_SCORES[grade]) return null

  let score = GRADE_SCORES[grade]

  // Penalty if inspection > 4 years old
  if (nursery.last_inspection_date) {
    const inspDate = new Date(nursery.last_inspection_date)
    const ageYears = (Date.now() - inspDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    if (ageYears > 4) score -= 15
  }

  // Bonus if no enforcement notice
  if (nursery.enforcement_notice === false) score += 10

  return Math.max(0, Math.min(100, score))
}

/**
 * Compute cost_score based on fee_avg_monthly vs local average.
 * 100 = cheapest quartile locally, 0 = most expensive.
 */
export function computeCostScore(nursery, localAvgPrice) {
  if (!nursery.fee_avg_monthly) return null
  if (!localAvgPrice || localAvgPrice <= 0) return 50 // no data, neutral

  // Ratio: lower fee vs area avg is better
  const ratio = nursery.fee_avg_monthly / localAvgPrice
  if (ratio <= 0.75) return 100  // cheapest quartile
  if (ratio <= 0.9) return 80
  if (ratio <= 1.1) return 60
  if (ratio <= 1.25) return 40
  return 20 // most expensive
}

/**
 * Compute availability_score from nursery_availability rows.
 */
export function computeAvailabilityScore(availabilityRows) {
  if (!availabilityRows || availabilityRows.length === 0) return null

  // Find the best availability across age groups
  let bestScore = 0

  for (const row of availabilityRows) {
    const vacancies = (row.total_capacity || 0) - (row.current_enrolled || 0)
    if (vacancies > 0) {
      bestScore = Math.max(bestScore, 100) // immediate vacancy
    } else if (row.next_available) {
      const daysUntil = (new Date(row.next_available).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      if (daysUntil <= 90) bestScore = Math.max(bestScore, 50)
      else if (daysUntil <= 180) bestScore = Math.max(bestScore, 25)
      // else 0
    }
  }

  return bestScore || 0
}

/**
 * Compute staff_score from nursery_staff data.
 * Composite of ratio quality + qualification level.
 */
export function computeStaffScore(staffRow) {
  if (!staffRow) return null

  let score = 50 // base

  // Qualification bonus
  if (staffRow.total_staff && staffRow.total_staff > 0) {
    const qualPct = ((staffRow.qualified_teachers || 0) + (staffRow.level_3_plus || 0)) / staffRow.total_staff
    score += Math.round(qualPct * 30) // up to +30
  }

  // Tenure bonus
  if (staffRow.avg_tenure_months && staffRow.avg_tenure_months > 24) {
    score += 10
  }

  // Ratio quality: parse ratios like "1:3" — lower ratio is better
  const ratios = [staffRow.ratio_under_2, staffRow.ratio_2_to_3, staffRow.ratio_3_plus].filter(Boolean)
  if (ratios.length > 0) {
    const avgRatio = ratios.reduce((sum, r) => {
      const parts = r.split(':')
      return sum + (parts.length === 2 ? parseInt(parts[1]) / parseInt(parts[0]) : 4)
    }, 0) / ratios.length
    if (avgRatio <= 3) score += 10
    else if (avgRatio <= 4) score += 5
  }

  return Math.max(0, Math.min(100, score))
}

/**
 * Compute sentiment_score from review data on the nursery.
 */
export function computeSentimentScore(nursery) {
  if (!nursery.review_avg_rating && !nursery.review_count) return null
  if (!nursery.review_avg_rating) return null

  let score = Math.round(nursery.review_avg_rating * 20) // 0-100

  // Bonus if many reviews
  if (nursery.review_count > 5) score += 5

  // Penalty if low recommend rate
  if (nursery.review_recommend_pct != null && nursery.review_recommend_pct < 70) {
    score -= 10
  }

  return Math.max(0, Math.min(100, score))
}

/**
 * Recompute all dimension scores for all nurseries in batches.
 */
export async function recomputeAllDimensionScores() {
  if (!db) {
    logger.warn('recomputeAllDimensionScores: database not configured')
    return { updated: 0 }
  }

  let totalUpdated = 0
  let offset = 0
  const now = new Date().toISOString()

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: nurseries, error } = await db
      .from('nurseries')
      .select('id, urn, ofsted_overall_grade, last_inspection_date, enforcement_notice, fee_avg_monthly, review_avg_rating, review_count, review_recommend_pct, postcode')
      .range(offset, offset + BATCH_SIZE - 1)
      .order('id', { ascending: true })

    if (error) {
      logger.error({ error: error.message }, 'scoring: failed to fetch nurseries batch')
      break
    }

    if (!nurseries || nurseries.length === 0) break

    for (const nursery of nurseries) {
      const quality_score = computeQualityScore(nursery)
      const sentiment_score = computeSentimentScore(nursery)

      // Cost score — try to get local average from postcode_areas
      let cost_score = null
      if (nursery.fee_avg_monthly && nursery.postcode) {
        const district = nursery.postcode.split(' ')[0]
        if (district) {
          try {
            const { data: area } = await db
              .from('postcode_areas')
              .select('avg_sale_price_all')
              .eq('postcode_district', district)
              .maybeSingle()
            // Use avg_sale_price as a proxy for local cost level
            // Approximate monthly nursery cost relative to area wealth
            const localProxy = area?.avg_sale_price_all
              ? Math.round(area.avg_sale_price_all / 300) // rough monthly proxy
              : null
            cost_score = computeCostScore(nursery, localProxy)
          } catch {
            cost_score = computeCostScore(nursery, null)
          }
        }
      }

      // Availability score
      let availability_score = null
      try {
        const { data: avRows } = await db
          .from('nursery_availability')
          .select('*')
          .eq('nursery_id', nursery.id)
        availability_score = computeAvailabilityScore(avRows)
      } catch {
        // skip
      }

      // Staff score
      let staff_score = null
      try {
        const { data: staffRow } = await db
          .from('nursery_staff')
          .select('*')
          .eq('nursery_id', nursery.id)
          .maybeSingle()
        staff_score = computeStaffScore(staffRow)
      } catch {
        // skip
      }

      const update = {
        quality_score,
        cost_score,
        availability_score,
        staff_score,
        sentiment_score,
        dimension_scores_updated_at: now,
      }

      try {
        await db.from('nurseries').update(update).eq('id', nursery.id)
        totalUpdated++
      } catch (err) {
        logger.warn({ err: err.message, nurseryId: nursery.id }, 'scoring: update failed')
      }
    }

    offset += BATCH_SIZE
    if (nurseries.length < BATCH_SIZE) break
  }

  logger.info({ updated: totalUpdated }, 'scoring: dimension scores recomputed')
  return { updated: totalUpdated }
}
