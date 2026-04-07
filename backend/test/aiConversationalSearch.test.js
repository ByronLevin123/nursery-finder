import { describe, it, expect, vi, beforeEach } from 'vitest'

const callClaudeMock = vi.fn()

vi.mock('../src/services/claudeApi.js', () => ({
  callClaude: (...args) => callClaudeMock(...args),
  isClaudeAvailable: () => true,
  ClaudeUnavailableError: class extends Error {},
}))

let parseNaturalLanguageSearch
beforeEach(async () => {
  vi.resetModules()
  callClaudeMock.mockReset()
  ;({ parseNaturalLanguageSearch } = await import('../src/services/aiConversationalSearch.js'))
})

describe('parseNaturalLanguageSearch', () => {
  it('returns parsed object on valid JSON response', async () => {
    callClaudeMock.mockResolvedValueOnce(
      JSON.stringify({
        postcode: 'SW11',
        grade: 'Outstanding',
        funded_2yr: true,
        funded_3yr: null,
        radius_km: 3,
        maxCrimeRate: 15,
        minFamilyScore: 70,
        maxPrice: null,
        keywords: null,
      })
    )
    const out = await parseNaturalLanguageSearch(
      'Outstanding nurseries near Battersea with funded 2 year places'
    )
    expect(out.postcode).toBe('SW11')
    expect(out.grade).toBe('Outstanding')
    expect(out.funded_2yr).toBe(true)
    expect(out.minFamilyScore).toBe(70)
  })

  it('strips markdown code fences if present', async () => {
    callClaudeMock.mockResolvedValueOnce('```json\n{"postcode":"E1","grade":null}\n```')
    const out = await parseNaturalLanguageSearch('any query')
    expect(out.postcode).toBe('E1')
  })

  it('returns null-filled defaults on malformed JSON', async () => {
    callClaudeMock.mockResolvedValueOnce('not json at all')
    const out = await parseNaturalLanguageSearch('hello')
    expect(out).toMatchObject({
      postcode: null,
      grade: null,
      funded_2yr: null,
    })
  })

  it('throws on empty query', async () => {
    await expect(parseNaturalLanguageSearch('')).rejects.toThrow(/required/)
  })
})
