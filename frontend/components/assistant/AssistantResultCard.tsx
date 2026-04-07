'use client'

import Link from 'next/link'
import type { AssistantArea } from '@/lib/api'
import MatchBadge from '@/components/MatchBadge'

interface Props {
  area: AssistantArea
}

export default function AssistantResultCard({ area }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div>
          <Link
            href={`/nurseries-in/${area.postcode_district.toLowerCase()}`}
            className="text-lg font-bold text-gray-900 hover:text-indigo-600"
          >
            {area.postcode_district}
          </Link>
          {area.local_authority && (
            <p className="text-xs text-gray-500">{area.local_authority}</p>
          )}
        </div>
        <MatchBadge score={area.score} size="md" />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-2">
        {area.family_score != null && (
          <div>
            <span className="text-gray-500">Family:</span>{' '}
            <span className="font-semibold">{area.family_score}</span>
          </div>
        )}
        {area.nursery_outstanding_pct != null && (
          <div>
            <span className="text-gray-500">Outstanding:</span>{' '}
            <span className="font-semibold text-green-700">{area.nursery_outstanding_pct}%</span>
          </div>
        )}
        {area.crime_rate_per_1000 != null && (
          <div>
            <span className="text-gray-500">Crime:</span>{' '}
            <span className="font-semibold">{area.crime_rate_per_1000.toFixed(1)}</span>
          </div>
        )}
        {area.imd_decile != null && (
          <div>
            <span className="text-gray-500">IMD:</span>{' '}
            <span className="font-semibold">{area.imd_decile}/10</span>
          </div>
        )}
        {area.avg_sale_price_all != null && (
          <div className="col-span-2">
            <span className="text-gray-500">Avg price:</span>{' '}
            <span className="font-semibold">£{Math.round(area.avg_sale_price_all).toLocaleString()}</span>
          </div>
        )}
      </div>

      {area.match_rationale && (
        <p className="mt-2 text-xs text-gray-700 leading-relaxed bg-indigo-50 border border-indigo-100 rounded-md p-2">
          {area.match_rationale}
        </p>
      )}

      {area.distance_km != null && (
        <p className="text-[11px] text-gray-400 mt-2">📍 {area.distance_km.toFixed(1)}km away</p>
      )}
    </div>
  )
}
