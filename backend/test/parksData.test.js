import { describe, it, expect } from 'vitest'
import { parseOverpassParks } from '../src/services/parksData.js'

const sample = {
  elements: [
    { type: 'way', id: 1, center: { lat: 51.51, lon: -0.13 }, tags: { name: 'Soho Square' } },
    {
      type: 'way',
      id: 2,
      center: { lat: 51.5074, lon: -0.1278 },
      tags: { name: 'Trafalgar Park' },
    },
    { type: 'relation', id: 3, center: { lat: 51.52, lon: -0.15 }, tags: {} },
    { type: 'way', id: 4, tags: { name: 'No Coords' } },
  ],
}

describe('parseOverpassParks', () => {
  it('extracts parks with name and coords', () => {
    const parks = parseOverpassParks(sample)
    expect(parks.length).toBe(3)
    expect(parks[0]).toHaveProperty('lat')
    expect(parks[0]).toHaveProperty('lng')
  })

  it('computes distance and sorts by it when origin given', () => {
    const origin = { lat: 51.5074, lng: -0.1278 }
    const parks = parseOverpassParks(sample, origin)
    expect(parks[0].name).toBe('Trafalgar Park')
    expect(parks[0].distance_m).toBeLessThan(50)
    expect(parks[1].distance_m).toBeGreaterThan(parks[0].distance_m)
  })

  it('handles empty / malformed input', () => {
    expect(parseOverpassParks(null)).toEqual([])
    expect(parseOverpassParks({})).toEqual([])
    expect(parseOverpassParks({ elements: [] })).toEqual([])
  })

  it('skips elements without coordinates', () => {
    const parks = parseOverpassParks({
      elements: [{ type: 'way', tags: { name: 'X' } }],
    })
    expect(parks.length).toBe(0)
  })
})
