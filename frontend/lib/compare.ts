'use client'

const STORAGE_KEY = 'nursery-compare'
const MAX_COMPARE = 5
export const FREE_COMPARE_LIMIT = 3

export function getCompareList(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export type AddResult = 'added' | 'duplicate' | 'full' | 'auth_required'

export function addToCompare(urn: string, isAuthed = false): AddResult {
  const list = getCompareList()
  if (list.includes(urn)) return 'duplicate'
  if (!isAuthed && list.length >= FREE_COMPARE_LIMIT) return 'auth_required'
  if (list.length >= MAX_COMPARE) return 'full'
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...list, urn]))
  window.dispatchEvent(new Event('compare-updated'))
  return 'added'
}

export function removeFromCompare(urn: string): void {
  const list = getCompareList().filter(u => u !== urn)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  window.dispatchEvent(new Event('compare-updated'))
}

export function isInCompare(urn: string): boolean {
  return getCompareList().includes(urn)
}

export function getCompareCount(): number {
  return getCompareList().length
}

export function clearCompare(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
  window.dispatchEvent(new Event('compare-updated'))
}
