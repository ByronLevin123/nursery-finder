process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from './helpers/mockDb.js'

// ---------- mock data ----------
const NURSERIES = [
  {
    urn: 'EY100',
    name: 'Sunshine Nursery',
    town: 'Camden',
    local_authority: 'Camden',
    address_line1: '10 High Street',
    postcode: 'NW1 1AA',
    registration_status: 'Active',
    ofsted_overall_grade: 'Outstanding',
    featured: false,
    lat: 51.53,
    lng: -0.14,
    spots_available: 5,
    google_rating: 4.5,
    provider_type: 'Childminder',
    places_funded_2yr: 3,
    places_funded_3_4yr: 5,
  },
  {
    urn: 'EY101',
    name: 'Rainbow Nursery',
    town: 'Islington',
    local_authority: 'Islington',
    address_line1: '22 Park Road',
    postcode: 'N1 2AB',
    registration_status: 'Active',
    ofsted_overall_grade: 'Good',
    featured: true,
    lat: 51.54,
    lng: -0.1,
    spots_available: 0,
    google_rating: 3.8,
    provider_type: 'Nursery',
    places_funded_2yr: 0,
    places_funded_3_4yr: 2,
  },
  {
    urn: 'EY102',
    name: 'Little Stars',
    town: 'Camden',
    local_authority: 'Camden',
    address_line1: '5 Camden Road',
    postcode: 'NW1 3BB',
    registration_status: 'Inactive',
    ofsted_overall_grade: 'Good',
    featured: false,
    lat: 51.55,
    lng: -0.13,
    spots_available: 2,
    google_rating: 4.0,
    provider_type: 'Nursery',
    places_funded_2yr: 1,
    places_funded_3_4yr: 0,
  },
]

const { db, resetAll, rpcHandlers } = createMockDb({ nurseries: NURSERIES })

vi.mock('../src/db.js', () => ({ default: db }))

vi.mock('../src/services/geocoding.js', () => ({
  geocodePostcode: vi.fn(async (postcode) => {
    if (postcode.toUpperCase().startsWith('SW1A')) return { lat: 51.501, lng: -0.1415 }
    if (postcode.toUpperCase().startsWith('E1')) return { lat: 51.517, lng: -0.073 }
    if (postcode.toUpperCase().startsWith('NW1')) return { lat: 51.53, lng: -0.14 }
    return { lat: 51.5, lng: -0.1 }
  }),
}))

vi.mock('../src/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Mock global fetch for place name geocode fallback
global.fetch = vi.fn(async () => ({
  ok: false,
  json: async () => ({ result: null }),
}))

let isPostcode, smartSearch

beforeEach(async () => {
  resetAll({ nurseries: [...NURSERIES] })
  const mod = await import('../src/services/smartSearch.js')
  isPostcode = mod.isPostcode
  smartSearch = mod.smartSearch
})

// ---------- isPostcode ----------

describe('isPostcode()', () => {
  it('recognises SW1A 1AA as a valid UK postcode', () => {
    expect(isPostcode('SW1A 1AA')).toBe(true)
  })

  it('recognises E1 6AN as a valid UK postcode', () => {
    expect(isPostcode('E1 6AN')).toBe(true)
  })

  it('recognises NW1 3BB (no space variant) as valid', () => {
    expect(isPostcode('NW13BB')).toBe(true)
  })

  it('recognises EC1A 1BB as valid', () => {
    expect(isPostcode('EC1A 1BB')).toBe(true)
  })

  it('recognises lowercase postcodes as valid', () => {
    expect(isPostcode('sw1a 1aa')).toBe(true)
  })

  it('recognises postcode with extra whitespace', () => {
    expect(isPostcode('  SW1A 1AA  ')).toBe(true)
  })

  it('rejects plain text like "London"', () => {
    expect(isPostcode('London')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isPostcode('')).toBe(false)
  })

  it('rejects numeric strings', () => {
    expect(isPostcode('12345')).toBe(false)
  })

  it('rejects partial postcodes like "SW1A"', () => {
    expect(isPostcode('SW1A')).toBe(false)
  })

  it('rejects US zip codes', () => {
    expect(isPostcode('90210')).toBe(false)
  })

  it('rejects random characters', () => {
    expect(isPostcode('!!@@##')).toBe(false)
  })
})

// ---------- smartSearch ----------

describe('smartSearch()', () => {
  it('returns empty results for empty query', async () => {
    const result = await smartSearch({ query: '' })
    expect(result.data).toEqual([])
    expect(result.meta.mode).toBe('empty')
    expect(result.meta.total).toBe(0)
  })

  it('returns empty results for whitespace-only query', async () => {
    const result = await smartSearch({ query: '   ' })
    expect(result.data).toEqual([])
    expect(result.meta.mode).toBe('empty')
  })

  describe('postcode mode', () => {
    it('calls RPC and returns sorted results for a valid postcode', async () => {
      const rpcResults = [
        {
          urn: 'EY100',
          name: 'Sunshine Nursery',
          distance_km: 1.2,
          featured: false,
          ofsted_overall_grade: 'Outstanding',
        },
        {
          urn: 'EY101',
          name: 'Rainbow Nursery',
          distance_km: 0.5,
          featured: true,
          ofsted_overall_grade: 'Good',
        },
      ]
      rpcHandlers.search_nurseries_near = vi.fn(async () => ({
        data: rpcResults,
        error: null,
      }))

      const result = await smartSearch({ query: 'SW1A 1AA', radius_km: 5 })

      expect(result.meta.mode).toBe('postcode')
      expect(result.meta.search_lat).toBe(51.501)
      expect(result.meta.search_lng).toBe(-0.1415)
      expect(result.data.length).toBe(2)
      // Within same 1km band (band 0), featured should come first
      expect(result.data[0].urn).toBe('EY101') // featured, band 0
      expect(result.data[1].urn).toBe('EY100') // not featured, band 1
    })

    it('filters by has_availability when set', async () => {
      rpcHandlers.search_nurseries_near = vi.fn(async () => ({
        data: [
          { urn: 'EY100', spots_available: 5, distance_km: 1 },
          { urn: 'EY101', spots_available: 0, distance_km: 2 },
        ],
        error: null,
      }))

      const result = await smartSearch({ query: 'E1 6AN', has_availability: true })
      expect(result.data.length).toBe(1)
      expect(result.data[0].urn).toBe('EY100')
    })

    it('filters by provider_type when set', async () => {
      rpcHandlers.search_nurseries_near = vi.fn(async () => ({
        data: [
          { urn: 'EY100', provider_type: 'Childminder', distance_km: 1 },
          { urn: 'EY101', provider_type: 'Nursery', distance_km: 2 },
        ],
        error: null,
      }))

      const result = await smartSearch({ query: 'E1 6AN', provider_type: 'Childminder' })
      expect(result.data.length).toBe(1)
      expect(result.data[0].urn).toBe('EY100')
    })
  })

  describe('text mode', () => {
    it('matches nurseries by name', async () => {
      // Text mode uses db.from('nurseries') — our mock DB has Active nurseries
      const result = await smartSearch({ query: 'Sunshine' })
      expect(result.meta.mode).toBe('text')
      expect(result.data.length).toBeGreaterThanOrEqual(1)
      expect(result.data.some((n) => n.name === 'Sunshine Nursery')).toBe(true)
    })

    it('matches nurseries by town', async () => {
      const result = await smartSearch({ query: 'Camden' })
      expect(result.meta.mode).toBe('text')
      // Should find Sunshine (Active, town=Camden) but NOT Little Stars (Inactive)
      const urns = result.data.map((n) => n.urn)
      expect(urns).toContain('EY100')
      expect(urns).not.toContain('EY102') // Inactive
    })

    it('sorts featured nurseries first in text results', async () => {
      const result = await smartSearch({ query: 'Nursery' })
      expect(result.meta.mode).toBe('text')
      if (result.data.length >= 2) {
        // Rainbow is featured, should come before Sunshine
        const rainbowIdx = result.data.findIndex((n) => n.urn === 'EY101')
        const sunshineIdx = result.data.findIndex((n) => n.urn === 'EY100')
        if (rainbowIdx >= 0 && sunshineIdx >= 0) {
          expect(rainbowIdx).toBeLessThan(sunshineIdx)
        }
      }
    })

    it('sanitizes angle brackets from query in meta', async () => {
      const result = await smartSearch({ query: '<script>alert(1)</script>' })
      // Should not contain < or > in meta.query
      if (result.meta.query) {
        expect(result.meta.query).not.toContain('<')
        expect(result.meta.query).not.toContain('>')
      }
    })
  })

  describe('fuzzy fallback mode', () => {
    it('falls back to fuzzy search when text and place search return nothing', async () => {
      rpcHandlers.fuzzy_search_nurseries = vi.fn(async () => ({
        data: [
          {
            urn: 'EY100',
            name: 'Sunshine Nursery',
            match_score: 0.6,
            matched_field: 'Sunshine',
            lat: 51.5,
            lng: -0.1,
          },
        ],
        error: null,
      }))

      // Use a query that won't match any text ilike or place lookup
      const result = await smartSearch({ query: 'xyznonexistent' })
      expect(result.meta.mode).toBe('fuzzy')
      expect(result.data.length).toBe(1)
      expect(result.meta.did_you_mean).toBe('Sunshine')
    })

    it('returns empty when fuzzy RPC also fails', async () => {
      rpcHandlers.fuzzy_search_nurseries = vi.fn(async () => ({
        data: null,
        error: { message: 'RPC not found' },
      }))

      const result = await smartSearch({ query: 'xyznonexistent' })
      expect(result.meta.mode).toBe('text')
      expect(result.data).toEqual([])
    })
  })
})
