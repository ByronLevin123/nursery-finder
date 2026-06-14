import { describe, it, expect } from 'vitest'
import { loadGuides, parseFrontmatter, weeklyIndex } from '../src/services/contentLibrary.js'

describe('parseFrontmatter', () => {
  it('extracts quoted frontmatter values and the body', () => {
    const { meta, body } = parseFrontmatter('---\ntitle: "Hello"\nslug: hello\n---\nBody text')
    expect(meta.title).toBe('Hello')
    expect(meta.slug).toBe('hello')
    expect(body).toBe('Body text')
  })

  it('returns the whole content as body when there is no frontmatter', () => {
    const { meta, body } = parseFrontmatter('Just text')
    expect(meta).toEqual({})
    expect(body).toBe('Just text')
  })
})

describe('weeklyIndex', () => {
  it('is stable within a week and rotates across weeks', () => {
    const w1a = new Date('2026-06-08T00:00:00Z')
    const w1b = new Date('2026-06-10T00:00:00Z')
    const w2 = new Date('2026-06-16T00:00:00Z')
    expect(weeklyIndex(w1a, 5)).toBe(weeklyIndex(w1b, 5))
    // a week later the index advances by 1 (mod count)
    expect(weeklyIndex(w2, 5)).toBe((weeklyIndex(w1a, 5) + 1) % 5)
  })

  it('is safe with zero guides', () => {
    expect(weeklyIndex(new Date(), 0)).toBe(0)
  })
})

describe('loadGuides', () => {
  it('loads the real guides newest-first with slug/title/excerpt', () => {
    const guides = loadGuides()
    expect(guides.length).toBeGreaterThan(0)
    expect(guides[0]).toHaveProperty('slug')
    expect(guides[0]).toHaveProperty('title')
    // sorted by date descending
    const dates = guides.map((g) => g.date || '')
    expect([...dates]).toEqual([...dates].sort().reverse())
  })

  it('returns an empty array for a missing directory (no throw)', () => {
    expect(loadGuides('/nope/does/not/exist')).toEqual([])
  })
})
