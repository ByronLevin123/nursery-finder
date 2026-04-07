'use client'

const STORAGE_KEY = 'nursery-shortlist'
const MAX_SHORTLIST = 10
export const FREE_SHORTLIST_LIMIT = 3

export function getShortlist(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export type AddResult = 'added' | 'duplicate' | 'full' | 'auth_required'

export function addToShortlist(urn: string, isAuthed = false): AddResult {
  const list = getShortlist()
  if (list.includes(urn)) return 'duplicate'
  if (!isAuthed && list.length >= FREE_SHORTLIST_LIMIT) return 'auth_required'
  if (list.length >= MAX_SHORTLIST) return 'full'
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...list, urn]))
  window.dispatchEvent(new Event('shortlist-updated'))
  return 'added'
}

export function removeFromShortlist(urn: string): void {
  const list = getShortlist().filter(u => u !== urn)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  window.dispatchEvent(new Event('shortlist-updated'))
}

export function isInShortlist(urn: string): boolean {
  return getShortlist().includes(urn)
}

export function getShortlistCount(): number {
  return getShortlist().length
}
