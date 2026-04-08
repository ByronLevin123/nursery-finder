// Pure scoring helper for postcode districts against assistant criteria.
// Required priorities are HARD filters; "priority" weighted 2x; "nice" weighted 1x.

const PRIORITY_KEYS = ['nursery_quality', 'low_crime', 'low_deprivation', 'affordability']

function clamp(v, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v))
}

function weightFor(level) {
  if (level === 'priority') return 2
  if (level === 'nice') return 1
  return 0
}

// Component scores 0-100 derived from area fields.
function nurseryQualityScore(area) {
  if (area?.nursery_outstanding_pct == null) return null
  return clamp(Number(area.nursery_outstanding_pct))
}

function familyOverallScore(area) {
  if (area?.family_score == null) return null
  return clamp(Number(area.family_score))
}

function lowCrimeScore(area) {
  if (area?.crime_rate_per_1000 == null) return null
  // 0 crime → 100, 100/1000 → 0
  return clamp(100 - Number(area.crime_rate_per_1000) * 5)
}

function lowDeprivationScore(area) {
  if (area?.imd_decile == null) return null
  // IMD decile 10 = least deprived
  return clamp(Number(area.imd_decile) * 10)
}

function affordabilityScore(area, budget) {
  const price = area?.avg_sale_price_all
  if (price == null || price <= 0) return null
  const max = budget?.max
  if (max && max > 0) {
    if (price <= max * 0.7) return 100
    if (price <= max) return clamp(100 - ((price - max * 0.7) / (max * 0.3)) * 40)
    if (price <= max * 1.2) return clamp(60 - ((price - max) / (max * 0.2)) * 60)
    return 0
  }
  // No budget — rough scale 150k → 100, 900k → 0
  const lo = 150_000
  const hi = 900_000
  return clamp(100 - ((price - lo) / (hi - lo)) * 100)
}

// scoreDistrict({area, criteria}) → {score, breakdown, excluded, reasons}
export function scoreDistrict(area, criteria) {
  const reasons = []
  const breakdown = {}
  const priorities = criteria?.priorities || {}
  const budget = criteria?.budget || {}

  const components = {
    nursery_quality: nurseryQualityScore(area),
    low_crime: lowCrimeScore(area),
    low_deprivation: lowDeprivationScore(area),
    affordability: affordabilityScore(area, budget),
  }

  // Hard filters (required) — exclude if data missing or score < 40
  let excluded = false
  for (const key of PRIORITY_KEYS) {
    if (priorities[key] === 'required') {
      const v = components[key]
      if (v == null) {
        // Missing data is not a hard exclusion — soften to penalty so districts
        // without crime/IMD coverage still surface. Reasons help debugging.
        reasons.push(`Missing data for required: ${key} (not excluded)`)
      } else if (v < 40) {
        excluded = true
        reasons.push(`Required ${key} below threshold (${Math.round(v)})`)
      }
    }
  }

  // Affordability hard filter when budget.max set: price must be <= 1.2 * max
  if (budget?.max && area?.avg_sale_price_all && area.avg_sale_price_all > budget.max * 1.2) {
    excluded = true
    reasons.push(
      `Price ~£${Math.round(area.avg_sale_price_all)} exceeds budget cap £${Math.round(
        budget.max * 1.2
      )}`
    )
  }

  // Weighted average of components that have a priority level set
  let weightedSum = 0
  let totalWeight = 0
  for (const key of PRIORITY_KEYS) {
    const level = priorities[key]
    const w = weightFor(level) + (level === 'required' ? 2 : 0)
    breakdown[key] = {
      level: level || null,
      value: components[key],
      weight: w,
    }
    if (w > 0 && components[key] != null) {
      weightedSum += components[key] * w
      totalWeight += w
    }
  }

  // If no usable weighted components, fall back to overall family_score
  let raw
  if (totalWeight > 0) {
    raw = weightedSum / totalWeight
  } else {
    raw = familyOverallScore(area)
    if (raw == null) raw = 0
  }

  const score = excluded ? 0 : Math.round(clamp(raw))

  return { score, breakdown, excluded, reasons }
}

// Commute scoring — given a travel-time result in seconds and max minutes,
// returns {score, excluded}. Excludes districts exceeding the max.
// Proportional score: at 0 min => 100, at max_minutes => 40, above => excluded.
export function scoreCommute(durationSeconds, maxMinutes) {
  if (durationSeconds == null || !Number.isFinite(durationSeconds)) {
    return { score: null, excluded: false }
  }
  if (!maxMinutes || !Number.isFinite(maxMinutes) || maxMinutes <= 0) {
    return { score: null, excluded: false }
  }
  const mins = durationSeconds / 60
  if (mins > maxMinutes) {
    return { score: 0, excluded: true }
  }
  const ratio = mins / maxMinutes
  const score = clamp(100 - ratio * 60)
  return { score: Math.round(score), excluded: false }
}
