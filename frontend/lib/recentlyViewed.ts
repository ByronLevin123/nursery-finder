const STORAGE_KEY = 'ctn_recently_viewed'
const MAX_ITEMS = 10

export interface RecentItem {
  urn: string
  name: string
  grade: string | null
  town: string | null
  viewedAt: number
}

export function addRecentlyViewed(item: Omit<RecentItem, 'viewedAt'>): void {
  if (typeof window === 'undefined') return
  try {
    const list = getRecentlyViewed()
    const filtered = list.filter((r) => r.urn !== item.urn)
    filtered.unshift({ ...item, viewedAt: Date.now() })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_ITEMS)))
    window.dispatchEvent(new Event('recently-viewed-updated'))
  } catch {
    // localStorage quota or parse error — ignore
  }
}

export function getRecentlyViewed(): RecentItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentItem[]
    return parsed.sort((a, b) => b.viewedAt - a.viewedAt)
  } catch {
    return []
  }
}

export function clearRecentlyViewed(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event('recently-viewed-updated'))
}
