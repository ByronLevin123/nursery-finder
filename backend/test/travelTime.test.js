import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db BEFORE importing the service
vi.mock('../src/db.js', () => ({ default: null }))

// Mock axios
vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))

import axios from 'axios'
import {
  getTravelTime,
  getTravelMatrix,
  cacheKey,
  haversineFallback,
} from '../src/services/travelTime.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('cacheKey', () => {
  it('is stable for the same rounded inputs', () => {
    const k1 = cacheKey({
      fromLat: 51.50731,
      fromLng: -0.12782,
      toLat: 51.5145,
      toLng: -0.0988,
      mode: 'walk',
    })
    const k2 = cacheKey({
      fromLat: 51.50731,
      fromLng: -0.12782,
      toLat: 51.51451,
      toLng: -0.09881,
      mode: 'walk',
    })
    expect(k1).toBe(k2)
  })

  it('changes when mode changes', () => {
    const a = cacheKey({ fromLat: 51.5, fromLng: -0.1, toLat: 51.6, toLng: -0.1, mode: 'walk' })
    const b = cacheKey({ fromLat: 51.5, fromLng: -0.1, toLat: 51.6, toLng: -0.1, mode: 'drive' })
    expect(a).not.toBe(b)
  })
})

describe('haversineFallback', () => {
  it('estimates walk time at roughly 12 min/km', () => {
    const r = haversineFallback({
      fromLat: 51.5,
      fromLng: -0.1,
      toLat: 51.51,
      toLng: -0.1,
      mode: 'walk',
    })
    // ~1.11km -> ~13 minutes
    expect(r.distance_m).toBeGreaterThan(900)
    expect(r.distance_m).toBeLessThan(1300)
    expect(r.duration_s).toBeGreaterThan(600)
    expect(r.duration_s).toBeLessThan(1100)
    expect(r.fallback).toBe(true)
  })

  it('drive is faster than walk', () => {
    const opts = { fromLat: 51.5, fromLng: -0.1, toLat: 51.55, toLng: -0.1 }
    const walk = haversineFallback({ ...opts, mode: 'walk' })
    const drive = haversineFallback({ ...opts, mode: 'drive' })
    expect(drive.duration_s).toBeLessThan(walk.duration_s)
  })
})

describe('getTravelTime', () => {
  it('returns duration/distance from OSRM response', async () => {
    axios.get.mockResolvedValueOnce({
      data: { routes: [{ duration: 720, distance: 1400 }] },
    })
    const r = await getTravelTime({
      fromLat: 51.5,
      fromLng: -0.1,
      toLat: 51.52,
      toLng: -0.08,
      mode: 'walk',
    })
    expect(r.duration_s).toBe(720)
    expect(r.distance_m).toBe(1400)
    expect(r.mode).toBe('walk')
  })

  it('falls back to haversine when OSRM fails', async () => {
    axios.get.mockRejectedValueOnce(new Error('network'))
    const r = await getTravelTime({
      fromLat: 51.5,
      fromLng: -0.1,
      toLat: 51.51,
      toLng: -0.1,
      mode: 'walk',
    })
    expect(r.fallback).toBe(true)
    expect(r.duration_s).toBeGreaterThan(0)
  })

  it('rejects unknown modes', async () => {
    await expect(
      getTravelTime({ fromLat: 51.5, fromLng: -0.1, toLat: 51.6, toLng: -0.1, mode: 'boat' })
    ).rejects.toThrow(/mode/i)
  })
})

describe('getTravelMatrix', () => {
  it('calls OSRM Table API and returns a row per destination', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        durations: [[100, 200, 300]],
        distances: [[500, 1000, 1500]],
      },
    })
    const result = await getTravelMatrix({
      from: { lat: 51.5, lng: -0.1 },
      to: [
        { lat: 51.51, lng: -0.1 },
        { lat: 51.52, lng: -0.1 },
        { lat: 51.53, lng: -0.1 },
      ],
      mode: 'drive',
    })
    expect(result).toHaveLength(3)
    expect(result[0].duration_s).toBe(100)
    expect(result[2].distance_m).toBe(1500)
  })

  it('falls back per-destination on table failure', async () => {
    axios.get.mockRejectedValueOnce(new Error('500'))
    const result = await getTravelMatrix({
      from: { lat: 51.5, lng: -0.1 },
      to: [{ lat: 51.51, lng: -0.1 }],
      mode: 'walk',
    })
    expect(result).toHaveLength(1)
    expect(result[0].fallback).toBe(true)
  })

  it('returns empty array for empty to list', async () => {
    const result = await getTravelMatrix({ from: { lat: 51.5, lng: -0.1 }, to: [], mode: 'walk' })
    expect(result).toEqual([])
  })
})
