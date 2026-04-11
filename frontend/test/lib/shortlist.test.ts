import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getShortlist,
  addToShortlist,
  removeFromShortlist,
  isInShortlist,
  getShortlistCount,
} from '@/lib/shortlist'

describe('shortlist', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getShortlist', () => {
    it('returns empty array when no data', () => {
      expect(getShortlist()).toEqual([])
    })

    it('returns stored URNs', () => {
      localStorage.setItem('nursery-shortlist', JSON.stringify(['urn-1', 'urn-2']))
      expect(getShortlist()).toEqual(['urn-1', 'urn-2'])
    })

    it('handles corrupt data gracefully', () => {
      localStorage.setItem('nursery-shortlist', 'bad-json')
      expect(getShortlist()).toEqual([])
    })
  })

  describe('addToShortlist', () => {
    it('adds a URN and returns "added"', () => {
      const result = addToShortlist('urn-1')
      expect(result).toBe('added')
      expect(getShortlist()).toEqual(['urn-1'])
    })

    it('returns "duplicate" for existing URN', () => {
      addToShortlist('urn-1')
      const result = addToShortlist('urn-1')
      expect(result).toBe('duplicate')
      expect(getShortlist()).toHaveLength(1)
    })

    it('allows adding up to 10 nurseries without auth (free for all)', () => {
      for (let i = 0; i < 9; i++) {
        addToShortlist(`urn-${i}`)
      }
      const result = addToShortlist('urn-extra')
      expect(result).toBe('added')
      expect(getShortlist()).toHaveLength(10)
    })

    it('returns "full" at max 10 items', () => {
      for (let i = 0; i < 10; i++) {
        addToShortlist(`urn-${i}`)
      }
      const result = addToShortlist('urn-11')
      expect(result).toBe('full')
    })

    it('dispatches shortlist-updated event', () => {
      const handler = vi.fn()
      window.addEventListener('shortlist-updated', handler)
      addToShortlist('urn-1')
      expect(handler).toHaveBeenCalledTimes(1)
      window.removeEventListener('shortlist-updated', handler)
    })
  })

  describe('removeFromShortlist', () => {
    it('removes a URN', () => {
      addToShortlist('urn-1')
      addToShortlist('urn-2')
      removeFromShortlist('urn-1')
      expect(getShortlist()).toEqual(['urn-2'])
    })

    it('dispatches event', () => {
      addToShortlist('urn-1')
      const handler = vi.fn()
      window.addEventListener('shortlist-updated', handler)
      removeFromShortlist('urn-1')
      expect(handler).toHaveBeenCalledTimes(1)
      window.removeEventListener('shortlist-updated', handler)
    })
  })

  describe('isInShortlist', () => {
    it('returns true for existing URN', () => {
      addToShortlist('urn-1')
      expect(isInShortlist('urn-1')).toBe(true)
    })

    it('returns false for missing URN', () => {
      expect(isInShortlist('urn-1')).toBe(false)
    })
  })

  describe('getShortlistCount', () => {
    it('returns count of items', () => {
      addToShortlist('urn-1')
      addToShortlist('urn-2')
      expect(getShortlistCount()).toBe(2)
    })
  })
})
