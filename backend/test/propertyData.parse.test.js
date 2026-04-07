import { describe, it, expect } from 'vitest'
import {
  parsePrices,
  parseRents,
  parseYields,
  parseDemand,
  parseGrowth,
} from '../src/services/propertyData.js'

const pricesFixture = { status: 'success', data: { average: 747500, points_analysed: 20 } }
const rentsFixture = {
  status: 'success',
  data: { long_let: { average: 562, unit: 'gbp_per_week' } },
}
const yieldsFixture = { status: 'success', data: { long_let: { gross_yield: '3.9%' } } }
const demandFixture = {
  status: 'success',
  demand_rating: 'Balanced market',
  days_on_market: 254,
  total_for_sale: 104,
}
const growthFixture = {
  status: 'success',
  data: [
    ['Apr 2024', 854074, '-4.3%'],
    ['Apr 2025', 779790, '-8.7%'],
    ['Apr 2026', 739094, '-5.2%'],
  ],
}

describe('propertyData parsers', () => {
  it('parsePrices extracts average', () => {
    expect(parsePrices(pricesFixture)).toEqual({ asking_price_avg: 747500 })
  })

  it('parseRents extracts long_let average', () => {
    expect(parseRents(rentsFixture)).toEqual({ rent_avg_weekly: 562 })
  })

  it('parseYields strips percent sign', () => {
    expect(parseYields(yieldsFixture)).toEqual({ gross_yield_pct: 3.9 })
  })

  it('parseDemand extracts rating and days on market', () => {
    expect(parseDemand(demandFixture)).toEqual({
      demand_rating: 'Balanced market',
      days_on_market: 254,
    })
  })

  it('parseGrowth uses last row 3rd element', () => {
    expect(parseGrowth(growthFixture)).toEqual({ price_growth_1yr_pct: -5.2 })
  })

  it('parsePrices returns null for empty/missing data', () => {
    expect(parsePrices({}).asking_price_avg).toBeNull()
    expect(parsePrices({ data: {} }).asking_price_avg).toBeNull()
  })

  it('parseRents returns null when long_let missing', () => {
    expect(parseRents({ data: {} }).rent_avg_weekly).toBeNull()
    expect(parseRents({}).rent_avg_weekly).toBeNull()
  })

  it('parseYields returns null when gross_yield missing', () => {
    expect(parseYields({}).gross_yield_pct).toBeNull()
    expect(parseYields({ data: { long_let: {} } }).gross_yield_pct).toBeNull()
  })

  it('parseDemand returns nulls when fields missing', () => {
    expect(parseDemand({})).toEqual({ demand_rating: null, days_on_market: null })
  })

  it('parseGrowth returns null for empty data array', () => {
    expect(parseGrowth({ data: [] }).price_growth_1yr_pct).toBeNull()
    expect(parseGrowth({}).price_growth_1yr_pct).toBeNull()
  })

  it('parseGrowth returns null when last row 3rd element is null', () => {
    expect(parseGrowth({ data: [['Apr 2025', 100, null]] }).price_growth_1yr_pct).toBeNull()
  })

  it('parseYields handles numeric values without percent sign', () => {
    expect(parseYields({ data: { long_let: { gross_yield: 4.25 } } }).gross_yield_pct).toBe(4.25)
  })

  it('parsers do not throw on null input', () => {
    expect(() => parsePrices(null)).not.toThrow()
    expect(() => parseRents(null)).not.toThrow()
    expect(() => parseYields(null)).not.toThrow()
    expect(() => parseDemand(null)).not.toThrow()
    expect(() => parseGrowth(null)).not.toThrow()
  })
})
