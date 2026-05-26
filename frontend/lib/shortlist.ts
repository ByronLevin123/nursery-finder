'use client'

const STORAGE_KEY = 'nursery-shortlist'
const MAX_SHORTLIST = 10

export type ShortlistItemType = 'nursery' | 'school'

export interface ShortlistEntry {
  type: ShortlistItemType
  urn: string
}

function migrate(raw: unknown): ShortlistEntry[] {
  if (!Array.isArray(raw)) return []
  if (raw.length === 0) return []
  if (typeof raw[0] === 'string') {
    return raw.map((urn: string) => ({ type: 'nursery' as const, urn }))
  }
  return raw as ShortlistEntry[]
}

export function getShortlist(): ShortlistEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const entries = migrate(raw)
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    }
    return entries
  } catch {
    return []
  }
}

export function getShortlistUrns(): string[] {
  return getShortlist().map(e => e.urn)
}

export function getShortlistByType(type: ShortlistItemType): ShortlistEntry[] {
  return getShortlist().filter(e => e.type === type)
}

export type AddResult = 'added' | 'duplicate' | 'full'

export function addToShortlist(urn: string, type: ShortlistItemType = 'nursery'): AddResult {
  const list = getShortlist()
  if (list.some(e => e.urn === urn)) return 'duplicate'
  if (list.length >= MAX_SHORTLIST) return 'full'
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...list, { type, urn }]))
  window.dispatchEvent(new Event('shortlist-updated'))
  return 'added'
}

export function removeFromShortlist(urn: string): void {
  const list = getShortlist().filter(e => e.urn !== urn)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  window.dispatchEvent(new Event('shortlist-updated'))
}

export function isInShortlist(urn: string): boolean {
  return getShortlist().some(e => e.urn === urn)
}

export function getShortlistCount(): number {
  return getShortlist().length
}
