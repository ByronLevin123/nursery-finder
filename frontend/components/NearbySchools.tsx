'use client'

import { useState, useEffect } from 'react'
import { getNearbySchools, School } from '@/lib/api'

function OfstedBadge({ rating }: { rating: string | null }) {
  if (!rating) {
    return (
      <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
        Not rated
      </span>
    )
  }

  const colors: Record<string, string> = {
    Outstanding: 'bg-green-100 text-green-800',
    Good: 'bg-blue-100 text-blue-800',
    'Requires Improvement': 'bg-amber-100 text-amber-800',
    Inadequate: 'bg-red-100 text-red-800',
  }

  return (
    <span
      className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${colors[rating] || 'bg-gray-100 text-gray-500'}`}
    >
      {rating}
    </span>
  )
}

export default function NearbySchools({ lat, lng }: { lat: number; lng: number }) {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getNearbySchools(lat, lng, 1, 'Primary').then((data) => {
      if (!cancelled) {
        setSchools(data)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [lat, lng])

  if (loading) {
    return (
      <section className="mb-6">
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4">
            <div className="h-5 w-64 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </section>
    )
  }

  if (schools.length === 0) return null

  return (
    <section className="mb-6">
      <div className="bg-white border border-gray-200 rounded-lg">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition rounded-lg"
        >
          <h2 className="text-sm font-semibold text-gray-900">
            Nearby Primary Schools ({schools.length} within 1km)
          </h2>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-2">
            {schools.map((school) => (
              <div
                key={school.urn}
                className="flex items-start justify-between gap-3 py-2 border-t border-gray-100"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {school.website ? (
                      <a
                        href={school.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline truncate"
                      >
                        {school.name}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {school.name}
                      </p>
                    )}
                    <OfstedBadge rating={school.ofsted_rating} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                    {school.age_range && <span>Ages {school.age_range}</span>}
                    {school.age_range && school.pupils && (
                      <span className="text-gray-300">|</span>
                    )}
                    {school.pupils && <span>{school.pupils} pupils</span>}
                  </div>
                </div>
                <div className="text-xs text-gray-400 whitespace-nowrap pt-0.5">
                  {school.distance_km != null
                    ? `${(school.distance_km * 1000).toFixed(0)}m`
                    : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
