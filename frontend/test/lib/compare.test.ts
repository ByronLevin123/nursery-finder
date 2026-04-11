import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCompareList,
  addToCompare,
  removeFromCompare,
  isInCompare,
  getCompareCount,
  clearCompare,
} from '@/lib/compare'

describe('compare', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getCompareList', () => {
    it('returns empty array when no data', () => {
      expect(getCompareList()).toEqual([])
    })

    it('returns stored URNs', () => {
      localStorage.setItem('nursery-compare', JSON.stringify(['a', 'b']))
      expect(getCompareList()).toEqual(['a', 'b'])
    })

    it('handles corrupt data', () => {
      localStorage.setItem('nursery-compare', '{bad}')
      expect(getCompareList()).toEqual([])
    })
  })

  describe('addToCompare', () => {
    it('adds URN and returns "added"', () => {
      expect(addToCompare('urn-1')).toBe('added')
      expect(getCompareList()).toEqual(['urn-1'])
    })

    it('returns "duplicate" for existing URN', () => {
      addToCompare('urn-1')
      expect(addToCompare('urn-1')).toBe('duplicate')
    })

    it('allows adding up to 5 nurseries without auth (free for all)', () => {
      for (let i = 0; i < 4; i++) addToCompare(`urn-${i}`)
      expect(addToCompare('urn-4')).toBe('added')
      expect(getCompareList()).toHaveLength(5)
    })

    it('returns "full" at max 5 items', () => {
      for (let i = 0; i < 5; i++) addToCompare(`urn-${i}`)
      expect(addToCompare('urn-6')).toBe('full')
    })

    it('dispatches event', () => {
      const handler = vi.fn()
      window.addEventListener('compare-updated', handler)
      addToCompare('urn-1')
      expect(handler).toHaveBeenCalled()
      window.removeEventListener('compare-updated', handler)
    })
  })

  describe('removeFromCompare', () => {
    it('removes a URN', () => {
      addToCompare('urn-1')
      addToCompare('urn-2')
      removeFromCompare('urn-1')
      expect(getCompareList()).toEqual(['urn-2'])
    })
  })

  describe('isInCompare', () => {
    it('returns true/false', () => {
      addToCompare('urn-1')
      expect(isInCompare('urn-1')).toBe(true)
      expect(isInCompare('urn-2')).toBe(false)
    })
  })

  describe('clearCompare', () => {
    it('empties the list', () => {
      addToCompare('urn-1')
      clearCompare()
      expect(getCompareList()).toEqual([])
    })
  })

  describe('getCompareCount', () => {
    it('returns count', () => {
      addToCompare('a')
      addToCompare('b')
      expect(getCompareCount()).toBe(2)
    })
  })
})
