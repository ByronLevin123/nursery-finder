import { describe, it, expect } from 'vitest'
import { chunkPostcodes } from '../src/services/geocoding.js'

describe('chunkPostcodes', () => {
  it('chunks an array into groups of given size', () => {
    const arr = Array.from({ length: 250 }, (_, i) => `PC${i}`)
    const chunks = chunkPostcodes(arr, 100)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(100)
    expect(chunks[1]).toHaveLength(100)
    expect(chunks[2]).toHaveLength(50)
  })

  it('defaults to size 100', () => {
    const arr = Array.from({ length: 150 }, (_, i) => i)
    const chunks = chunkPostcodes(arr)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(100)
  })

  it('returns empty array for empty input', () => {
    expect(chunkPostcodes([])).toEqual([])
  })

  it('returns empty array for non-array input', () => {
    expect(chunkPostcodes(null)).toEqual([])
  })
})
