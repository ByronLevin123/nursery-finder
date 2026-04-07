'use client'

import { useEffect, useState } from 'react'
import { AreaSummary, getAreaSummary } from '@/lib/api'

interface Props {
  district: string | null
  variant?: 'compact' | 'full'
}

function gbp(n: number | null | undefined) {
  if (n == null) return null
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `£${Math.round(n / 1000)}k`
  return `£${n}`
}

export default function AreaSummaryCard({ district, variant = 'compact' }: Props) {
  const [area, setArea] = useState<AreaSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!district) return
    setLoading(true)
    getAreaSummary(district)
      .then(setArea)
      .catch(() => setArea(null))
      .finally(() => { setLoading(false); setTried(true) })
  }, [district])

  if (!district) return null
  if (loading) return null
  if (tried && !area) return null

  const hasPrice = area?.avg_sale_price_all != null
  const hasNurseries = (area?.nursery_count_total ?? 0) > 0
  const hasLiveMarket =
    area?.asking_price_avg != null ||
    area?.rent_avg_weekly != null ||
    area?.gross_yield_pct != null ||
    area?.demand_rating != null ||
    area?.days_on_market != null ||
    area?.price_growth_1yr_pct != null

  if (!hasPrice && !hasNurseries && !hasLiveMarket) return null

  const growth = area?.price_growth_1yr_pct
  const growthPositive = typeof growth === 'number' && growth > 0
  const growthNegative = typeof growth === 'number' && growth < 0
  const growthColor = growthPositive
    ? 'text-green-700'
    : growthNegative
      ? 'text-red-700'
      : 'text-purple-900'
  const growthArrow = growthPositive ? '▲' : growthNegative ? '▼' : ''

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-purple-900">📍 Area: {district}</p>
        {area?.family_score != null && (
          <span className="text-xs bg-purple-200 text-purple-900 px-2 py-0.5 rounded-full font-semibold">
            Family score {area.family_score}/10
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {hasNurseries && (
          <div>
            <p className="text-xs text-purple-700 uppercase">Nurseries nearby</p>
            <p className="font-medium text-purple-900">
              {area!.nursery_count_total} total
              {area!.nursery_count_outstanding ? ` · ${area!.nursery_count_outstanding} Outstanding` : ''}
            </p>
            {area!.nursery_outstanding_pct != null && (
              <p className="text-xs text-purple-700">{area!.nursery_outstanding_pct}% Outstanding</p>
            )}
          </div>
        )}

        {hasPrice && (
          <div>
            <p className="text-xs text-purple-700 uppercase">Avg sold price (12mo)</p>
            <p className="font-medium text-purple-900">{gbp(area!.avg_sale_price_all)}</p>
            {variant === 'full' && (
              <p className="text-xs text-purple-700">
                {area!.avg_sale_price_flat ? `Flat ${gbp(area!.avg_sale_price_flat)} · ` : ''}
                {area!.avg_sale_price_terraced ? `Terraced ${gbp(area!.avg_sale_price_terraced)}` : ''}
              </p>
            )}
          </div>
        )}

        {variant === 'full' && area?.crime_rate_per_1000 != null && (
          <div>
            <p className="text-xs text-purple-700 uppercase">Crime rate</p>
            <p className="font-medium text-purple-900">{area.crime_rate_per_1000}/1000</p>
          </div>
        )}

        {variant === 'full' && area?.flood_risk_level && (
          <div>
            <p className="text-xs text-purple-700 uppercase">Flood risk</p>
            <p className="font-medium text-purple-900">{area.flood_risk_level}</p>
          </div>
        )}

        {variant === 'compact' && area?.demand_rating && (
          <div className="col-span-2">
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
              Market: {area.demand_rating}
            </span>
          </div>
        )}
      </div>

      {variant === 'full' && hasLiveMarket && (
        <div className="mt-3 pt-3 border-t border-purple-200">
          <p className="text-xs text-purple-700 uppercase mb-2 font-semibold">Live market</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {area?.asking_price_avg != null && (
              <div>
                <p className="text-xs text-purple-700 uppercase">Current asking</p>
                <p className="font-medium text-purple-900">{gbp(area.asking_price_avg)}</p>
              </div>
            )}
            {area?.rent_avg_weekly != null && (
              <div>
                <p className="text-xs text-purple-700 uppercase">Avg rent</p>
                <p className="font-medium text-purple-900">
                  £{area.rent_avg_weekly} pw
                  {area.gross_yield_pct != null ? ` · ${area.gross_yield_pct}% yield` : ''}
                </p>
              </div>
            )}
            {area?.demand_rating != null && (
              <div>
                <p className="text-xs text-purple-700 uppercase">Demand</p>
                <p className="font-medium text-purple-900">
                  {area.demand_rating}
                  {area.days_on_market != null ? ` · ${area.days_on_market}d on market` : ''}
                </p>
              </div>
            )}
            {growth != null && (
              <div>
                <p className="text-xs text-purple-700 uppercase">1yr growth</p>
                <p className={`font-medium ${growthColor}`}>
                  {growthArrow} {growth}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <a
        href={`/nurseries-in/${district.toLowerCase()}`}
        className="text-xs text-purple-700 hover:underline mt-2 inline-block"
      >
        View full area report →
      </a>
    </div>
  )
}
