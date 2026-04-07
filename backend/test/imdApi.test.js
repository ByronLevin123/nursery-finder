import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchImdDecileForPostcode } from '../src/services/imdApi.js'

describe('fetchImdDecileForPostcode', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the decile from a 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ decile: 7 }),
      })
    )
    expect(await fetchImdDecileForPostcode('SW1A 1AA')).toBe(7)
  })

  it('returns null on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      })
    )
    expect(await fetchImdDecileForPostcode('ZZ99 9ZZ')).toBeNull()
  })

  it('returns null when decile is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      })
    )
    expect(await fetchImdDecileForPostcode('SW1A 1AA')).toBeNull()
  })

  it('returns null for empty postcode', async () => {
    expect(await fetchImdDecileForPostcode('')).toBeNull()
    expect(await fetchImdDecileForPostcode(null)).toBeNull()
  })
})
