import { describe, it, expect, vi, beforeEach } from 'vitest'

const callClaudeMock = vi.fn()
const getCachedMock = vi.fn()
const setCachedMock = vi.fn()

vi.mock('../src/services/claudeApi.js', () => ({
  callClaude: (...args) => callClaudeMock(...args),
  isClaudeAvailable: () => true,
  ClaudeUnavailableError: class extends Error {},
}))

vi.mock('../src/services/aiCache.js', () => ({
  getCached: (...args) => getCachedMock(...args),
  setCached: (...args) => setCachedMock(...args),
}))

let mod
beforeEach(async () => {
  vi.resetModules()
  callClaudeMock.mockReset()
  getCachedMock.mockReset()
  setCachedMock.mockReset()
  getCachedMock.mockResolvedValue(null)
  setCachedMock.mockResolvedValue(undefined)
  mod = await import('../src/services/assistantCriteria.js')
})

describe('mergeCriteria', () => {
  it('keeps prior values when extracted has nulls', () => {
    const prior = {
      area: { postcode: 'SW11', district: null, region: null, max_distance_km: 5 },
      budget: { type: 'sale', min: null, max: 600000 },
      bedrooms: { min: 2 },
      priorities: {
        nursery_quality: 'priority',
        low_crime: null,
        low_deprivation: null,
        affordability: null,
      },
      notes: ['near a park'],
    }
    const extracted = {
      area: { postcode: null, district: null, region: null, max_distance_km: null },
      budget: { type: null, min: null, max: null },
      bedrooms: { min: null },
      priorities: {
        nursery_quality: null,
        low_crime: null,
        low_deprivation: null,
        affordability: null,
      },
      notes: [],
    }
    const out = mod.mergeCriteria(prior, extracted)
    expect(out.area.postcode).toBe('SW11')
    expect(out.budget.max).toBe(600000)
    expect(out.priorities.nursery_quality).toBe('priority')
    expect(out.notes).toContain('near a park')
  })

  it('overwrites when extracted has new values', () => {
    const prior = mod.EMPTY_CRITERIA
    const out = mod.mergeCriteria(prior, {
      area: { postcode: 'E8', district: null, region: null, max_distance_km: 3 },
      priorities: { low_crime: 'required' },
      notes: ['good transport'],
    })
    expect(out.area.postcode).toBe('E8')
    expect(out.area.max_distance_km).toBe(3)
    expect(out.priorities.low_crime).toBe('required')
    expect(out.notes).toEqual(['good transport'])
  })

  it('dedupes notes case-insensitively', () => {
    const prior = { ...mod.EMPTY_CRITERIA, notes: ['Near a Park'] }
    const out = mod.mergeCriteria(prior, { notes: ['near a park', 'good schools'] })
    expect(out.notes.length).toBe(2)
  })
})

describe('extractDistrictCriteria', () => {
  it('calls Claude, parses JSON, merges with prior', async () => {
    callClaudeMock.mockResolvedValueOnce(
      JSON.stringify({
        area: { postcode: 'SW11', district: null, region: null, max_distance_km: 5 },
        budget: { type: 'sale', min: null, max: 700000 },
        bedrooms: { min: 2 },
        priorities: {
          nursery_quality: 'priority',
          low_crime: 'required',
          low_deprivation: null,
          affordability: 'nice',
        },
        notes: [],
      })
    )
    const out = await mod.extractDistrictCriteria(
      'Looking near SW11 up to £700k, need low crime',
      null
    )
    expect(out.area.postcode).toBe('SW11')
    expect(out.priorities.low_crime).toBe('required')
    expect(setCachedMock).toHaveBeenCalled()
  })

  it('returns prior on malformed JSON', async () => {
    callClaudeMock.mockResolvedValueOnce('not json')
    const prior = {
      ...mod.EMPTY_CRITERIA,
      area: { postcode: 'N16', district: null, region: null, max_distance_km: null },
    }
    const out = await mod.extractDistrictCriteria('hello', prior)
    expect(out.area.postcode).toBe('N16')
  })

  it('uses cache when present', async () => {
    getCachedMock.mockResolvedValueOnce({
      content: JSON.stringify({
        area: { postcode: 'E8', district: null, region: null, max_distance_km: null },
      }),
    })
    const out = await mod.extractDistrictCriteria('any message', null)
    expect(out.area.postcode).toBe('E8')
    expect(callClaudeMock).not.toHaveBeenCalled()
  })

  it('throws on empty message', async () => {
    await expect(mod.extractDistrictCriteria('', null)).rejects.toThrow(/required/)
  })
})
