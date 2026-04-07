import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchImdDecileForPostcode, imdRankToDecile } from '../src/services/imdApi.js'

describe('imdRankToDecile', () => {
  it('maps rank 1 to decile 1 (most deprived)', () => {
    expect(imdRankToDecile(1)).toBe(1)
  })
  it('maps rank 32844 to decile 10 (least deprived)', () => {
    expect(imdRankToDecile(32844)).toBe(10)
  })
  it('maps mid rank to expected decile', () => {
    expect(imdRankToDecile(15550)).toBe(5)
  })
  it('returns null for invalid input', () => {
    expect(imdRankToDecile(null)).toBeNull()
    expect(imdRankToDecile(0)).toBeNull()
    expect(imdRankToDecile(99999)).toBeNull()
  })
})

describe('fetchImdDecileForPostcode', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns decile derived from findthatpostcode rank', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { attributes: { imd: 15550 } } }),
      })
    )
    expect(await fetchImdDecileForPostcode('SW11 5QN')).toBe(5)
  })

  it('returns null on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) })
    )
    expect(await fetchImdDecileForPostcode('ZZ99 9ZZ')).toBeNull()
  })

  it('returns null when rank is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { attributes: {} } }),
      })
    )
    expect(await fetchImdDecileForPostcode('SW1A 1AA')).toBeNull()
  })

  it('returns null for empty postcode', async () => {
    expect(await fetchImdDecileForPostcode('')).toBeNull()
    expect(await fetchImdDecileForPostcode(null)).toBeNull()
  })
})
