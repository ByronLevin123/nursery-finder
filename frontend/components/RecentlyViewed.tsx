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
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Recently viewed</h3>
        <button
          onClick={() => clearRecentlyViewed()}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Clear history
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {items.map((item) => (
          <Link
            key={item.urn}
            href={`/nursery/${item.urn}`}
            className="min-w-[200px] max-w-[240px] flex-shrink-0 bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition"
          >
            <p className="text-sm font-semibold text-gray-900 truncate mb-1">{item.name}</p>
            <div className="flex items-center gap-1.5 mb-1">
              {item.grade && <GradeBadge grade={item.grade} size="sm" />}
            </div>
            {item.town && <p className="text-xs text-gray-500">{item.town}</p>}
          </Link>
        ))}
      </div>
    </section>
  )
}
