import { describe, it, expect, beforeEach, vi } from 'vitest'
import { addRecentlyViewed, getRecentlyViewed, clearRecentlyViewed } from '@/lib/recentlyViewed'

describe('recentlyViewed', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('addRecentlyViewed', () => {
    it('adds an item to localStorage', () => {
      addRecentlyViewed({ urn: '123', name: 'Test Nursery', grade: 'Good', town: 'London' })
      const items = getRecentlyViewed()
      expect(items).toHaveLength(1)
      expect(items[0].urn).toBe('123')
      expect(items[0].name).toBe('Test Nursery')
      expect(items[0].grade).toBe('Good')
      expect(items[0].town).toBe('London')
      expect(items[0].viewedAt).toBeGreaterThan(0)
    })

    it('deduplicates by URN and moves to front', () => {
      addRecentlyViewed({ urn: '1', name: 'First', grade: null, town: null })
      addRecentlyViewed({ urn: '2', name: 'Second', grade: null, town: null })
      addRecentlyViewed({ urn: '1', name: 'First Updated', grade: 'Good', town: null })

      const items = getRecentlyViewed()
      expect(items).toHaveLength(2)
      expect(items[0].urn).toBe('1')
      expect(items[0].name).toBe('First Updated')
    })

    it('caps at 10 items', () => {
      for (let i = 0; i < 15; i++) {
        addRecentlyViewed({ urn: `urn-${i}`, name: `Nursery ${i}`, grade: null, town: null })
      }
      const items = getRecentlyViewed()
      expect(items.length).toBeLessThanOrEqual(10)
    })

    it('dispatches custom event', () => {
      const handler = vi.fn()
      window.addEventListener('recently-viewed-updated', handler)
      addRecentlyViewed({ urn: '1', name: 'Test', grade: null, town: null })
      expect(handler).toHaveBeenCalledTimes(1)
      window.removeEventListener('recently-viewed-updated', handler)
    })
  })

  describe('getRecentlyViewed', () => {
    it('returns empty array when no data', () => {
      expect(getRecentlyViewed()).toEqual([])
    })

    it('returns items sorted by viewedAt descending', () => {
      addRecentlyViewed({ urn: '1', name: 'Old', grade: null, town: null })
      // Small delay to ensure different timestamps
      addRecentlyViewed({ urn: '2', name: 'New', grade: null, town: null })

      const items = getRecentlyViewed()
      expect(items[0].urn).toBe('2')
    })

    it('handles corrupt localStorage gracefully', () => {
      localStorage.setItem('ctn_recently_viewed', 'not-json')
      expect(getRecentlyViewed()).toEqual([])
    })
  })

  describe('clearRecentlyViewed', () => {
    it('removes all items', () => {
      addRecentlyViewed({ urn: '1', name: 'Test', grade: null, town: null })
      clearRecentlyViewed()
      expect(getRecentlyViewed()).toEqual([])
    })

    it('dispatches custom event', () => {
      const handler = vi.fn()
      window.addEventListener('recently-viewed-updated', handler)
      clearRecentlyViewed()
      expect(handler).toHaveBeenCalledTimes(1)
      window.removeEventListener('recently-viewed-updated', handler)
    })
  })
})
