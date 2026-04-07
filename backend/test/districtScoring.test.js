import { describe, it, expect } from 'vitest'
import { scoreDistrict } from '../src/services/districtScoring.js'

const BASE_AREA = {
  postcode_district: 'SW11',
  nursery_outstanding_pct: 40,
  family_score: 72,
  crime_rate_per_1000: 12,
  imd_decile: 7,
  avg_sale_price_all: 550_000,
}

describe('scoreDistrict', () => {
  it('returns a weighted score when priorities are set', () => {
    const criteria = {
      priorities: {
        nursery_quality: 'priority',
        low_crime: 'priority',
        low_deprivation: 'nice',
        affordability: 'nice',
      },
      budget: { type: 'sale', min: null, max: 600_000 },
    }
    const r = scoreDistrict(BASE_AREA, criteria)
    expect(r.excluded).toBe(false)
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.breakdown.nursery_quality.weight).toBeGreaterThan(0)
  })

  it('falls back to family_score when no priorities set', () => {
    const r = scoreDistrict(BASE_AREA, { priorities: {}, budget: {} })
    expect(r.score).toBe(72)
    expect(r.excluded).toBe(false)
  })

  it('excludes a district when a required priority is below threshold', () => {
    const crim = { ...BASE_AREA, crime_rate_per_1000: 95 } // score ~ 0
    const r = scoreDistrict(crim, {
      priorities: { low_crime: 'required' },
      budget: {},
    })
    expect(r.excluded).toBe(true)
    expect(r.score).toBe(0)
    expect(r.reasons.join(' ')).toMatch(/low_crime/)
  })

  it('excludes when price grossly exceeds budget.max', () => {
    const pricey = { ...BASE_AREA, avg_sale_price_all: 2_000_000 }
    const r = scoreDistrict(pricey, {
      priorities: { affordability: 'priority' },
      budget: { type: 'sale', max: 500_000 },
    })
    expect(r.excluded).toBe(true)
    expect(r.reasons.join(' ')).toMatch(/budget cap/)
  })

  it('handles missing data gracefully when priority is nice', () => {
    const partial = {
      postcode_district: 'X1',
      nursery_outstanding_pct: null,
      family_score: 50,
      crime_rate_per_1000: 5,
      imd_decile: null,
      avg_sale_price_all: null,
    }
    const r = scoreDistrict(partial, {
      priorities: { nursery_quality: 'nice', low_crime: 'nice' },
      budget: {},
    })
    expect(r.excluded).toBe(false)
    expect(r.score).toBeGreaterThan(0)
    expect(r.breakdown.nursery_quality.value).toBe(null)
  })
})
