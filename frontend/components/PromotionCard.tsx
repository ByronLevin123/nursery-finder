'use client'

import { useEffect, useRef } from 'react'
import { API_URL } from '@/lib/api'

interface Promotion {
  id: string
  title: string
  description?: string | null
  image_url?: string | null
  link_url: string
  category: string
  distance_km?: number
}

interface Props {
  promotion: Promotion
  compact?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  swimming: 'Swimming',
  music: 'Music',
  tutoring: 'Tutoring',
  baby_gear: 'Baby Gear',
  dance: 'Dance',
  sports: 'Sports',
  arts: 'Arts',
  language: 'Language',
  childcare: 'Childcare',
  health: 'Health',
  other: 'Activity',
}

const CATEGORY_COLORS: Record<string, string> = {
  swimming: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  music: 'bg-violet-50 text-violet-700 border-violet-200',
  tutoring: 'bg-amber-50 text-amber-700 border-amber-200',
  baby_gear: 'bg-pink-50 text-pink-700 border-pink-200',
  dance: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  sports: 'bg-green-50 text-green-700 border-green-200',
  arts: 'bg-orange-50 text-orange-700 border-orange-200',
  language: 'bg-blue-50 text-blue-700 border-blue-200',
  childcare: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  health: 'bg-red-50 text-red-700 border-red-200',
  other: 'bg-gray-50 text-gray-700 border-gray-200',
}

export default function PromotionCard({ promotion, compact = false }: Props) {
  const impressionSent = useRef(false)

  // Fire impression on mount
  useEffect(() => {
    if (impressionSent.current) return
    impressionSent.current = true
    fetch(`${API_URL}/api/v1/promotions/${promotion.id}/impression`, {
      method: 'POST',
    }).catch(() => {})
  }, [promotion.id])

  function handleClick() {
    fetch(`${API_URL}/api/v1/promotions/${promotion.id}/click`, {
      method: 'POST',
    }).catch(() => {})
  }

  const categoryLabel = CATEGORY_LABELS[promotion.category] || 'Activity'
  const categoryColor = CATEGORY_COLORS[promotion.category] || CATEGORY_COLORS.other

  if (compact) {
    return (
      <a
        href={promotion.link_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        className="block bg-gradient-to-br from-blue-50 to-indigo-50 border border-dashed border-blue-200 rounded-xl p-4 hover:shadow-md transition group"
      >
        <div className="flex items-start gap-3">
          {promotion.image_url && (
            <img
              src={promotion.image_url}
              alt=""
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${categoryColor}`}>
                {categoryLabel}
              </span>
              <span className="text-[10px] text-gray-400 font-medium">Sponsored</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition truncate">
              {promotion.title}
            </p>
            {promotion.distance_km != null && (
              <p className="text-xs text-gray-400 mt-0.5">{promotion.distance_km} km away</p>
            )}
          </div>
        </div>
      </a>
    )
  }

  return (
    <a
      href={promotion.link_url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={handleClick}
      className="block bg-gradient-to-br from-blue-50 to-indigo-50 border border-dashed border-blue-200 rounded-xl overflow-hidden hover:shadow-md transition group"
    >
      {promotion.image_url && (
        <div className="h-36 bg-gray-100">
          <img
            src={promotion.image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${categoryColor}`}>
            {categoryLabel}
          </span>
          <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Sponsored</span>
        </div>
        <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition mb-1">
          {promotion.title}
        </h3>
        {promotion.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{promotion.description}</p>
        )}
        {promotion.distance_km != null && (
          <p className="text-xs text-gray-400 mt-2">{promotion.distance_km} km away</p>
        )}
      </div>
    </a>
  )
}
