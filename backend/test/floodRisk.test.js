import { describe, it, expect } from 'vitest'
import { parseFloodResponse } from '../src/services/floodRisk.js'

describe('parseFloodResponse', () => {
  it('returns Very Low when no items', () => {
    const r = parseFloodResponse({ items: [] })
    expect(r.level).toBe('Very Low')
    expect(r.area_count).toBe(0)
  })

  it('returns Low for a small number of areas with no severity', () => {
    const r = parseFloodResponse({ items: [{ id: 'a' }, { id: 'b' }] })
    expect(r.level).toBe('Low')
    expect(r.area_count).toBe(2)
  })

  it('returns High when severityLevel 1 (severe) is present', () => {
    const r = parseFloodResponse({ items: [{ severityLevel: 3 }, { severityLevel: 1 }] })
    expect(r.level).toBe('High')
    expect(r.area_count).toBe(2)
  })

  it('returns Medium for severityLevel 3 (alert)', () => {
    const r = parseFloodResponse({ items: [{ severityLevel: 3 }] })
    expect(r.level).toBe('Medium')
  })

  it('handles malformed input safely', () => {
    expect(parseFloodResponse(null)).toEqual({ level: null, area_count: 0 })
    expect(parseFloodResponse({})).toEqual({ level: 'Very Low', area_count: 0 })
  })
})
