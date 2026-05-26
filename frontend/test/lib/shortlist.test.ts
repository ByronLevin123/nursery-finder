import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getShortlist,
  getShortlistUrns,
  addToShortlist,
  removeFromShortlist,
  isInShortlist,
  getShortlistCount,
  getShortlistByType,
} from '@/lib/shortlist'

describe('shortlist', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getShortlist', () => {
    it('returns empty array when no data', () => {
      expect(getShortlist()).toEqual([])
    })

    it('returns stored entries', () => {
      addToShortlist('urn-1')
      addToShortlist('urn-2')
      expect(getShortlist()).toEqual([
        { type: 'nursery', urn: 'urn-1' },
        { type: 'nursery', urn: 'urn-2' },
      ])
    })

    it('handles corrupt data gracefully', () => {
      localStorage.setItem('nursery-shortlist', 'bad-json')
      expect(getShortlist()).toEqual([])
    })

    it('migrates old string[] format to new ShortlistEntry[] format', () => {
      localStorage.setItem('nursery-shortlist', JSON.stringify(['urn-1', 'urn-2']))
      const result = getShortlist()
      expect(result).toEqual([
        { type: 'nursery', urn: 'urn-1' },
        { type: 'nursery', urn: 'urn-2' },
      ])
      // Verify migration was persisted
      const raw = JSON.parse(localStorage.getItem('nursery-shortlist')!)
      expect(raw[0]).toHaveProperty('type', 'nursery')
    })
  })

  describe('getShortlistUrns', () => {
    it('returns just the URN strings', () => {
      addToShortlist('urn-1')
      addToShortlist('urn-2', 'school')
      expect(getShortlistUrns()).toEqual(['urn-1', 'urn-2'])
    })
  })

  describe('addToShortlist', () => {
    it('adds a URN and returns "added"', () => {
      const result = addToShortlist('urn-1')
      expect(result).toBe('added')
      expect(getShortlist()).toEqual([{ type: 'nursery', urn: 'urn-1' }])
    })

    it('supports adding different types', () => {
      addToShortlist('urn-1', 'nursery')
      addToShortlist('urn-2', 'school')
      expect(getShortlist()).toEqual([
        { type: 'nursery', urn: 'urn-1' },
        { type: 'school', urn: 'urn-2' },
      ])
    })

    it('returns "duplicate" for existing URN', () => {
      addToShortlist('urn-1')
      const result = addToShortlist('urn-1')
      expect(result).toBe('duplicate')
      expect(getShortlist()).toHaveLength(1)
    })

    it('allows adding up to 10 items without auth (free for all)', () => {
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
      expect(getShortlist()).toEqual([{ type: 'nursery', urn: 'urn-2' }])
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

  describe('getShortlistByType', () => {
    it('filters by type', () => {
      addToShortlist('urn-1', 'nursery')
      addToShortlist('urn-2', 'school')
      addToShortlist('urn-3', 'nursery')
      expect(getShortlistByType('nursery')).toEqual([
        { type: 'nursery', urn: 'urn-1' },
        { type: 'nursery', urn: 'urn-3' },
      ])
      expect(getShortlistByType('school')).toEqual([
        { type: 'school', urn: 'urn-2' },
      ])
    })
  })
})
