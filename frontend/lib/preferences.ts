import type { Nursery, AreaSummary } from './api'
import type { Session } from '@supabase/supabase-js'

export interface Preferences {
  // Quality
  minGrade: 'Outstanding' | 'Good' | 'any'
  excludeEnforcement: boolean
  maxInspectionYears: number // 2, 4, 6, 99

  // Places
  needsFunded2yr: boolean
  needsFunded3_4yr: boolean
  minTotalPlaces: number // 0 = any

  // Budget
  maxMonthlyFee: number | null
  minAffordabilityScore: number // 0-100

  // Location
  maxDistanceKm: number | null
  minFamilyScore: number // 0-100
  maxCrimeRate: number | null // per 1000
  minImdDecile: number // 1-10

  // Reviews
  requireReviews: boolean
  minAvgRating: number
  minRecommendPct: number

  // Weights 1-5
  weights: {
    quality: number
    places: number
    budget: number
    location: number
    reviews: number
  }
}

export const DEFAULT_PREFERENCES: Preferences = {
  minGrade: 'any',
  excludeEnforcement: true,
  maxInspectionYears: 99,
  needsFunded2yr: false,
  needsFunded3_4yr: false,
  minTotalPlaces: 0,
  maxMonthlyFee: null,
  minAffordabilityScore: 0,
  maxDistanceKm: null,
  minFamilyScore: 0,
  maxCrimeRate: null,
  minImdDecile: 1,
  requireReviews: false,
  minAvgRating: 0,
  minRecommendPct: 0,
  weights: {
    quality: 3,
    places: 3,
    budget: 3,
    location: 3,
    reviews: 3,
  },
}

const STORAGE_KEY = 'nf_preferences_v1'

export function loadPreferences(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      weights: { ...DEFAULT_PREFERENCES.weights, ...(parsed?.weights || {}) },
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function savePreferences(p: Preferences): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {}
}

export function clearPreferences(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

// Sync local preferences with the user's profile in the DB.
// DB wins on conflict for logged-in users; result is written back to localStorage
// AND to the DB so both sides converge. Idempotent — running twice is a no-op.
export async function syncPreferencesWithProfile(session: Session | null): Promise<void> {
  if (!session) return
  if (typeof window === 'undefined') return
  try {
    const { getProfile, updateProfile } = await import('./api')
    const token = session.access_token
    if (!token) return
    const profile = await getProfile(token)
    const local = loadPreferences()
    const remote = (profile?.preferences as Preferences | null) || null
    const merged: Preferences = remote
      ? { ...DEFAULT_PREFERENCES, ...local, ...remote, weights: { ...DEFAULT_PREFERENCES.weights, ...(local.weights || {}), ...(remote.weights || {}) } }
      : local
    savePreferences(merged)
    const remoteJson = JSON.stringify(remote || {})
    const mergedJson = JSON.stringify(merged)
    if (remoteJson !== mergedJson) {
      await updateProfile(token, { preferences: merged })
    }
  } catch {
    // best-effort, never throw
  }
}

export function hasActivePreferences(p: Preferences): boolean {
  const d = DEFAULT_PREFERENCES
  return (
    p.minGrade !== d.minGrade ||
    p.excludeEnforcement !== d.excludeEnforcement ||
    p.maxInspectionYears !== d.maxInspectionYears ||
    p.needsFunded2yr !== d.needsFunded2yr ||
    p.needsFunded3_4yr !== d.needsFunded3_4yr ||
    p.minTotalPlaces !== d.minTotalPlaces ||
    p.maxMonthlyFee !== d.maxMonthlyFee ||
    p.minAffordabilityScore !== d.minAffordabilityScore ||
    p.maxDistanceKm !== d.maxDistanceKm ||
    p.minFamilyScore !== d.minFamilyScore ||
    p.maxCrimeRate !== d.maxCrimeRate ||
    p.minImdDecile !== d.minImdDecile ||
    p.requireReviews !== d.requireReviews ||
    p.minAvgRating !== d.minAvgRating ||
    p.minRecommendPct !== d.minRecommendPct ||
    JSON.stringify(p.weights) !== JSON.stringify(d.weights)
  )
}

export interface RationaleItem {
  label: string
  status: 'pass' | 'fail' | 'unknown'
  detail?: string
}

export interface MatchResult {
  score: number // 0-100, 0 if excluded
  excluded: boolean
  excludedReasons: string[]
  rationale: RationaleItem[]
  componentScores: {
    quality: number
    places: number
    budget: number
    location: number
    reviews: number
  }
}

// Helpers
const GRADE_RANK: Record<string, number> = {
  Outstanding: 3,
  Good: 2,
  'Requires Improvement': 1,
  Inadequate: 0,
}

function gradeValue(grade: string | null): number {
  if (!grade) return 50
  switch (grade) {
    case 'Outstanding': return 100
    case 'Good': return 75
    case 'Requires Improvement': return 40
    case 'Inadequate': return 0
    default: return 50
  }
}

function yearsSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr).getTime()
  if (isNaN(d)) return null
  return (Date.now() - d) / (1000 * 60 * 60 * 24 * 365.25)
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v))
}

function affordabilityFromArea(area: AreaSummary | null): number | null {
  if (!area) return null
  // Derive rough affordability from avg_sale_price_all — lower price = more affordable.
  // Clamp between 150k (100) and 900k (0).
  const price = area.avg_sale_price_all
  if (price == null || price <= 0) return null
  const lo = 150_000
  const hi = 900_000
  const pct = 100 - ((price - lo) / (hi - lo)) * 100
  return clamp(pct)
}

export function scoreNursery(
  nursery: Nursery,
  area: AreaSummary | null,
  prefs: Preferences
): MatchResult {
  const rationale: RationaleItem[] = []
  const excludedReasons: string[] = []

  // ---- HARD FILTERS ----
  const grade = nursery?.ofsted_overall_grade ?? null
  const gradeRank = grade != null ? GRADE_RANK[grade] ?? -1 : -1

  if (prefs.minGrade !== 'any') {
    const needed = prefs.minGrade === 'Outstanding' ? 3 : 2
    if (gradeRank < needed) {
      excludedReasons.push(
        `Requires ${prefs.minGrade}${prefs.minGrade === 'Good' ? ' or better' : ''} (is ${grade ?? 'unrated'})`
      )
    }
  }

  if (prefs.excludeEnforcement && nursery?.enforcement_notice) {
    excludedReasons.push('Has an Ofsted enforcement notice')
  }

  const ageYears = yearsSince(nursery?.last_inspection_date ?? null)
  if (prefs.maxInspectionYears < 99 && ageYears != null && ageYears > prefs.maxInspectionYears) {
    excludedReasons.push(`Last inspection was ${ageYears.toFixed(1)} years ago`)
  }

  if (prefs.needsFunded2yr && !(nursery?.places_funded_2yr && nursery.places_funded_2yr > 0)) {
    excludedReasons.push('No funded 2-year places')
  }
  if (prefs.needsFunded3_4yr && !(nursery?.places_funded_3_4yr && nursery.places_funded_3_4yr > 0)) {
    excludedReasons.push('No funded 3-4yr places')
  }

  if (prefs.minTotalPlaces > 0) {
    const tp = nursery?.total_places ?? 0
    if (tp < prefs.minTotalPlaces) {
      excludedReasons.push(`Fewer than ${prefs.minTotalPlaces} total places`)
    }
  }

  if (prefs.maxDistanceKm != null && nursery?.distance_km != null && nursery.distance_km > prefs.maxDistanceKm) {
    excludedReasons.push(`Further than ${prefs.maxDistanceKm}km away`)
  }

  if (prefs.requireReviews && !(nursery?.review_count && nursery.review_count > 0)) {
    excludedReasons.push('No parent reviews yet')
  }

  // ---- SOFT SCORES ----

  // Quality
  let qualityScore = gradeValue(grade)
  if (ageYears != null) {
    const penalty = Math.min(30, Math.max(0, (ageYears - 2) * 5))
    qualityScore = clamp(qualityScore - penalty)
  }
  rationale.push({
    label: 'Ofsted quality',
    status: grade == null ? 'unknown' : gradeRank >= 2 ? 'pass' : 'fail',
    detail: grade ? `${grade}${ageYears != null ? `, ${ageYears.toFixed(1)}y old` : ''}` : 'Not yet inspected',
  })

  // Places
  let placesScore = 50
  let placesKnown = false
  const has2 = !!(nursery?.places_funded_2yr && nursery.places_funded_2yr > 0)
  const has34 = !!(nursery?.places_funded_3_4yr && nursery.places_funded_3_4yr > 0)
  if (prefs.needsFunded2yr || prefs.needsFunded3_4yr) {
    placesScore = 0
    placesKnown = true
    if (prefs.needsFunded2yr) placesScore += has2 ? 50 : 0
    else placesScore += 50
    if (prefs.needsFunded3_4yr) placesScore += has34 ? 50 : 0
    else placesScore += 50
  } else if (has2 || has34) {
    placesScore = 75
    placesKnown = true
  }
  rationale.push({
    label: 'Funded places',
    status: !prefs.needsFunded2yr && !prefs.needsFunded3_4yr
      ? (has2 || has34 ? 'pass' : 'unknown')
      : ((prefs.needsFunded2yr ? has2 : true) && (prefs.needsFunded3_4yr ? has34 : true) ? 'pass' : 'fail'),
    detail: [has2 ? '2yr ✓' : null, has34 ? '3-4yr ✓' : null].filter(Boolean).join(' · ') || 'none listed',
  })

  // Budget
  let budgetScore = 50
  let budgetKnown = false
  const fee = nursery?.fee_avg_monthly ?? null
  const feeReliable = fee != null && (nursery?.fee_report_count ?? 0) >= 3
  if (feeReliable && prefs.maxMonthlyFee != null && prefs.maxMonthlyFee > 0) {
    budgetScore = clamp(100 - (fee! / prefs.maxMonthlyFee) * 100 + 50)
    // Simpler linear: score high if fee well under max, low if equal/over
    budgetScore = clamp(((prefs.maxMonthlyFee - fee!) / prefs.maxMonthlyFee) * 100 + 50)
    budgetKnown = true
  } else if (feeReliable) {
    // No budget target — score by inverse relative to a rough ceiling of £2000
    budgetScore = clamp(100 - (fee! / 2000) * 100)
    budgetKnown = true
  } else {
    const afford = affordabilityFromArea(area)
    if (afford != null) {
      budgetScore = afford
      budgetKnown = true
    }
  }
  rationale.push({
    label: 'Budget',
    status: !budgetKnown ? 'unknown'
      : (prefs.maxMonthlyFee != null && feeReliable && fee! > prefs.maxMonthlyFee ? 'fail' : 'pass'),
    detail: feeReliable ? `~£${fee}/mo` : (area?.avg_sale_price_all ? 'area-estimated' : 'no fee data'),
  })

  // Location
  const locParts: number[] = []
  if (area?.family_score != null) locParts.push(clamp(area.family_score))
  if (area?.crime_rate_per_1000 != null) {
    locParts.push(clamp(100 - area.crime_rate_per_1000 * 5))
  }
  if (area?.imd_decile != null) {
    locParts.push(clamp(area.imd_decile * 10))
  }
  let locationScore = 50
  let locationKnown = false
  if (locParts.length > 0) {
    locationScore = locParts.reduce((a, b) => a + b, 0) / locParts.length
    locationKnown = true
  }
  let locPass: 'pass' | 'fail' | 'unknown' = locationKnown ? 'pass' : 'unknown'
  if (locationKnown) {
    if (area?.family_score != null && area.family_score < prefs.minFamilyScore) locPass = 'fail'
    if (prefs.maxCrimeRate != null && area?.crime_rate_per_1000 != null && area.crime_rate_per_1000 > prefs.maxCrimeRate) locPass = 'fail'
    if (area?.imd_decile != null && area.imd_decile < prefs.minImdDecile) locPass = 'fail'
  }
  rationale.push({
    label: 'Area / location',
    status: locPass,
    detail: area
      ? [
          area.family_score != null ? `family ${Math.round(area.family_score)}` : null,
          area.crime_rate_per_1000 != null ? `crime ${area.crime_rate_per_1000.toFixed(1)}` : null,
          area.imd_decile != null ? `IMD ${area.imd_decile}` : null,
        ].filter(Boolean).join(' · ')
      : 'no area data',
  })

  // Distance rationale
  if (nursery?.distance_km != null) {
    const dPass = prefs.maxDistanceKm == null
      ? 'pass'
      : nursery.distance_km <= prefs.maxDistanceKm ? 'pass' : 'fail'
    rationale.push({
      label: 'Distance',
      status: dPass,
      detail: `${nursery.distance_km.toFixed(1)}km away`,
    })
  }

  // Reviews
  let reviewsScore = 50
  let reviewsKnown = false
  const rc = nursery?.review_count ?? 0
  const avg = nursery?.review_avg_rating ?? null
  const rec = nursery?.review_recommend_pct ?? null
  if (rc > 0 && avg != null) {
    const recMultiplier = rec != null ? rec / 100 : 1
    reviewsScore = clamp(Number(avg) * 20 * recMultiplier)
    reviewsKnown = true
  }
  let revPass: 'pass' | 'fail' | 'unknown' = reviewsKnown ? 'pass' : 'unknown'
  if (reviewsKnown) {
    if (avg != null && Number(avg) < prefs.minAvgRating) revPass = 'fail'
    if (rec != null && rec < prefs.minRecommendPct) revPass = 'fail'
  }
  rationale.push({
    label: 'Parent reviews',
    status: revPass,
    detail: reviewsKnown
      ? `${Number(avg).toFixed(1)}★ (${rc})${rec != null ? `, ${Math.round(rec)}% rec` : ''}`
      : 'no reviews yet',
  })

  // Soft threshold exclusions — handled as soft downranking, not hard exclude (except hard filters above).

  // ---- WEIGHTED AVERAGE ----
  const w = prefs.weights
  const totalW = Math.max(0.0001, w.quality + w.places + w.budget + w.location + w.reviews)
  const weighted =
    (qualityScore * w.quality +
      placesScore * w.places +
      budgetScore * w.budget +
      locationScore * w.location +
      reviewsScore * w.reviews) / totalW

  const excluded = excludedReasons.length > 0

  return {
    score: excluded ? 0 : Math.round(clamp(weighted)),
    excluded,
    excludedReasons,
    rationale,
    componentScores: {
      quality: Math.round(qualityScore),
      places: Math.round(placesScore),
      budget: Math.round(budgetScore),
      location: Math.round(locationScore),
      reviews: Math.round(reviewsScore),
    },
  }
}
