'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import GradeBadge from './GradeBadge'
import { getRecentlyViewed, clearRecentlyViewed, RecentItem } from '@/lib/recentlyViewed'

export default function RecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>([])

  useEffect(() => {
    setItems(getRecentlyViewed())
    const handler = () => setItems(getRecentlyViewed())
    window.addEventListener('recently-viewed-updated', handler)
    return () => window.removeEventListener('recently-viewed-updated', handler)
  }, [])

  if (items.length === 0) return null

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Recently viewed</h3>
        <button
          onClick={clearRecentlyViewed}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Clear
        </button>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 5).map((item) => (
          <Link
            key={item.urn}
            href={`/nursery/${item.urn}`}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
              {item.town && <p className="text-xs text-gray-500">{item.town}</p>}
            </div>
            {item.grade && <GradeBadge grade={item.grade} size="sm" />}
          </Link>
        ))}
      </div>
    </div>
  )
}
