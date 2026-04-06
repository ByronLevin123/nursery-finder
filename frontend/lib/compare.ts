'use client'

const STORAGE_KEY = 'nursery-compare'
const MAX_COMPARE = 5

export function getCompareList(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function addToCompare(urn: string): boolean {
  const list = getCompareList()
  if (list.includes(urn) || list.length >= MAX_COMPARE) return false
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...list, urn]))
  window.dispatchEvent(new Event('compare-updated'))
  return true
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
