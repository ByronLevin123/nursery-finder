import { describe, it, expect, vi, beforeEach } from 'vitest'

const callClaudeMock = vi.fn(async () => 'A lovely Outstanding nursery in Battersea.')
const getCachedMock = vi.fn()
const setCachedMock = vi.fn(async () => {})

vi.mock('../src/services/claudeApi.js', () => ({
  callClaude: (...args) => callClaudeMock(...args),
  isClaudeAvailable: () => true,
  ClaudeUnavailableError: class extends Error {},
}))

vi.mock('../src/services/aiCache.js', () => ({
  getCached: (...args) => getCachedMock(...args),
  setCached: (...args) => setCachedMock(...args),
}))

const nurseryRow = {
  urn: 'EY100001',
  name: 'Sunny Day Nursery',
  town: 'Battersea',
  postcode: 'SW11 1AA',
  local_authority: 'Wandsworth',
  region: 'London',
  ofsted_overall_grade: 'Outstanding',
  last_inspection_date: '2024-01-01',
  total_places: 40,
  places_funded_2yr: 10,
  places_funded_3_4yr: 20,
  provider_type: 'Private',
  enforcement_notice: false,
}

vi.mock('../src/db.js', () => ({
  default: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: nurseryRow, error: null })),
        })),
      })),
    })),
  },
}))

let getNurserySummary
beforeEach(async () => {
  vi.resetModules()
  callClaudeMock.mockClear()
  getCachedMock.mockReset()
  setCachedMock.mockClear()
  ;({ getNurserySummary } = await import('../src/services/aiNurserySummary.js'))
})

describe('aiNurserySummary', () => {
  it('returns cached content without calling Claude', async () => {
    getCachedMock.mockResolvedValueOnce({
      content: 'cached summary',
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    })
    const result = await getNurserySummary('EY100001')
    expect(result).toBe('cached summary')
    expect(callClaudeMock).not.toHaveBeenCalled()
  })

  it('on cache miss, calls Claude and writes cache', async () => {
    getCachedMock.mockResolvedValueOnce(null)
    const result = await getNurserySummary('EY100001')
    expect(result).toMatch(/Outstanding/)
    expect(callClaudeMock).toHaveBeenCalledTimes(1)
    expect(setCachedMock).toHaveBeenCalledTimes(1)
    const [key, content] = setCachedMock.mock.calls[0]
    expect(key).toBe('nursery_summary:EY100001')
    expect(typeof content).toBe('string')
  })

  it('treats expired cache as miss and refreshes', async () => {
    // getCached already returns null for expired entries; simulate that path
    getCachedMock.mockResolvedValueOnce(null)
    await getNurserySummary('EY100001')
    expect(callClaudeMock).toHaveBeenCalledTimes(1)
  })
})
