'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import GradeBadge from './GradeBadge'
import FeaturedBadge from './FeaturedBadge'
import { getSimilarNurseries, Nursery } from '@/lib/api'

export default function SimilarNurseries({ urn }: { urn: string }) {
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getSimilarNurseries(urn).then((data) => {
      if (!cancelled) {
        setNurseries(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [urn])

  if (loading) {
    return (
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Similar nurseries nearby</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[220px] h-28 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (nurseries.length === 0) return null

  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Similar nurseries nearby</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {nurseries.map((n) => (
          <Link
            key={n.urn}
            href={`/nursery/${n.urn}`}
            className="min-w-[220px] max-w-[260px] flex-shrink-0 bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition"
          >
            <p className="text-sm font-semibold text-gray-900 truncate mb-1">{n.name}</p>
            <div className="flex items-center gap-1.5 mb-1">
              <GradeBadge grade={n.ofsted_overall_grade} size="sm" />
              {n.featured && <FeaturedBadge />}
            </div>
            <p className="text-xs text-gray-500">{n.town}</p>
            {n.distance_km != null && (
              <p className="text-xs text-gray-400 mt-1">{n.distance_km.toFixed(1)}km away</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
