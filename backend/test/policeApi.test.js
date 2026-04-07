import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computeCrimeRate, fetchCrimeCountForDistrict } from '../src/services/policeApi.js'

describe('computeCrimeRate', () => {
  it('converts a monthly average into a per-1000 rate', () => {
    // 120 crimes over 3 months = 40/month. 40 * 1000 / 12500 = 3.2
    expect(computeCrimeRate(120, 3)).toBe(3.2)
  })

  it('returns 0 when no crimes', () => {
    expect(computeCrimeRate(0, 3)).toBe(0)
  })

  it('returns 0 when monthsUsed is 0', () => {
    expect(computeCrimeRate(50, 0)).toBe(0)
  })

  it('rounds to 2 decimal places', () => {
    const rate = computeCrimeRate(37, 3)
    expect(rate).toBeCloseTo(0.99, 2)
  })
})

describe('fetchCrimeCountForDistrict', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('sums crimes across N completed months', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 1 }, { id: 2 }, { id: 3 }],
    })
    vi.stubGlobal('fetch', fetchMock)

    const promise = fetchCrimeCountForDistrict({ lat: 51.5, lng: -0.1, months: 3 })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.crime_count).toBe(9)
    expect(result.months_used).toBe(3)
  })

  it('tolerates 404 responses as empty months', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    const promise = fetchCrimeCountForDistrict({ lat: 51.5, lng: -0.1, months: 2 })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.crime_count).toBe(0)
    expect(result.months_used).toBe(2)
  })
})
