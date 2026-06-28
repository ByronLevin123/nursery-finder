'use client'

import { useEffect, useState } from 'react'
import { API_URL } from '@/lib/api'

/**
 * StatsStrip — live stats shown below the homepage hero search bar.
 *
 * Fetches the nursery count from the public health endpoint on mount,
 * then displays rounded numbers. Falls back to static defaults if the
 * fetch fails so the page never looks empty.
 */

function formatCount(n: number): string {
  if (n >= 1000) {
    const rounded = Math.floor(n / 1000) * 1000
    return `${rounded.toLocaleString('en-GB')}+`
  }
  return n.toLocaleString('en-GB')
}

export default function StatsStrip() {
  const [nurseryCount, setNurseryCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchStats() {
      try {
        const res = await fetch(`${API_URL}/api/v1/health`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && typeof data.nursery_count === 'number') {
          setNurseryCount(data.nursery_count)
        }
      } catch {
        // Silently fall back to static defaults
      }
    }
    fetchStats()
    return () => { cancelled = true }
  }, [])

  const displayCount = nurseryCount ? formatCount(nurseryCount) : '27,000+'

  return (
    <div className="flex flex-wrap justify-center gap-3 mt-6">
      <span className="px-3 py-1 bg-white/80 rounded-full text-xs font-medium text-gray-700 border border-gray-200 shadow-sm">
        {displayCount} nurseries compared
      </span>
      <span className="px-3 py-1 bg-white/80 rounded-full text-xs font-medium text-gray-700 border border-gray-200 shadow-sm">
        2,000+ districts
      </span>
      <span className="px-3 py-1 bg-white/80 rounded-full text-xs font-medium text-gray-700 border border-gray-200 shadow-sm">
        Updated daily
      </span>
    </div>
  )
}
