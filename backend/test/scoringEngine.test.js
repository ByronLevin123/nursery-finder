import { describe, it, expect } from 'vitest'
import {
  computeQualityScore,
  computeCostScore,
  computeAvailabilityScore,
  computeStaffScore,
  computeSentimentScore,
} from '../src/services/scoringEngine.js'

describe('computeQualityScore', () => {
  it('returns 95 for Outstanding + recent inspection + no enforcement', () => {
    const score = computeQualityScore({
      ofsted_overall_grade: 'Outstanding',
      last_inspection_date: new Date().toISOString(),
      enforcement_notice: false,
    })
    // 95 base + 10 no-enforcement bonus = 105, capped at 100
    expect(score).toBe(100)
  })

  it('returns 70 + 10 = 80 for Good with recent inspection + no enforcement', () => {
    const score = computeQualityScore({
      ofsted_overall_grade: 'Good',
      last_inspection_date: new Date().toISOString(),
      enforcement_notice: false,
    })
    expect(score).toBe(80)
  })

  it('applies -15 penalty for inspection > 4 years old', () => {
    const fiveYearsAgo = new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000).toISOString()
    const score = computeQualityScore({
      ofsted_overall_grade: 'Good',
      last_inspection_date: fiveYearsAgo,
      enforcement_notice: false,
    })
    // 70 - 15 + 10 = 65
    expect(score).toBe(65)
  })

  it('returns null for unknown grade', () => {
    expect(computeQualityScore({ ofsted_overall_grade: 'Unknown' })).toBeNull()
  })

  it('returns null when no grade', () => {
    expect(computeQualityScore({})).toBeNull()
  })

  it('returns 10 for Inadequate with enforcement', () => {
    const score = computeQualityScore({
      ofsted_overall_grade: 'Inadequate',
      last_inspection_date: new Date().toISOString(),
      enforcement_notice: true,
    })
    // 10 base, no enforcement bonus (enforcement_notice is true)
    expect(score).toBe(10)
  })
})

describe('computeCostScore', () => {
  it('returns null when no fee data', () => {
    expect(computeCostScore({ fee_avg_monthly: null }, 1000)).toBeNull()
  })

  it('returns 100 for cheapest quartile', () => {
    expect(computeCostScore({ fee_avg_monthly: 500 }, 1000)).toBe(100) // ratio 0.5
  })

  it('returns 50 when no local average', () => {
    expect(computeCostScore({ fee_avg_monthly: 800 }, null)).toBe(50)
  })

  it('returns 20 for most expensive', () => {
    expect(computeCostScore({ fee_avg_monthly: 1500 }, 1000)).toBe(20) // ratio 1.5
  })
})

describe('computeAvailabilityScore', () => {
  it('returns null for empty array', () => {
    expect(computeAvailabilityScore([])).toBeNull()
  })

  it('returns 100 for immediate vacancy', () => {
    const rows = [{ total_capacity: 20, current_enrolled: 15, next_available: null }]
    expect(computeAvailabilityScore(rows)).toBe(100)
  })

  it('returns 50 for availability within 3 months', () => {
    const soon = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days
    const rows = [{ total_capacity: 20, current_enrolled: 20, next_available: soon }]
    expect(computeAvailabilityScore(rows)).toBe(50)
  })

  it('returns 0 when fully enrolled with no availability date', () => {
    const rows = [{ total_capacity: 20, current_enrolled: 20 }]
    expect(computeAvailabilityScore(rows)).toBe(0)
  })
})

describe('computeStaffScore', () => {
  it('returns null when no staff data', () => {
    expect(computeStaffScore(null)).toBeNull()
  })

  it('returns base 50 for minimal data', () => {
    expect(computeStaffScore({})).toBe(50)
  })

  it('adds qualification bonus', () => {
    const score = computeStaffScore({
      total_staff: 10,
      qualified_teachers: 2,
      level_3_plus: 8,
    })
    // base 50 + qualPct (10/10=1.0 * 30 = 30) = 80
    expect(score).toBe(80)
  })

  it('adds tenure bonus', () => {
    const score = computeStaffScore({ avg_tenure_months: 36 })
    expect(score).toBe(60) // 50 + 10
  })
})

describe('computeSentimentScore', () => {
  it('returns null when no reviews', () => {
    expect(computeSentimentScore({})).toBeNull()
    expect(computeSentimentScore({ review_count: 0 })).toBeNull()
  })

  it('scores from avg rating * 20', () => {
    const score = computeSentimentScore({
      review_avg_rating: 4.5,
      review_count: 3,
    })
    // 4.5 * 20 = 90
    expect(score).toBe(90)
  })

  it('adds bonus for > 5 reviews', () => {
    const score = computeSentimentScore({
      review_avg_rating: 4.0,
      review_count: 10,
    })
    // 4.0 * 20 = 80 + 5 = 85
    expect(score).toBe(85)
  })

  it('penalizes low recommend rate', () => {
    const score = computeSentimentScore({
      review_avg_rating: 4.0,
      review_count: 3,
      review_recommend_pct: 50,
    })
    // 80 - 10 = 70
    expect(score).toBe(70)
  })
})
