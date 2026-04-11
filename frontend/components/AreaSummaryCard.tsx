'use client'

import { useEffect, useState } from 'react'
import { AreaSummary, getAreaSummary, API_URL } from '@/lib/api'

interface NearbySchool {
  urn: number
  name: string
  phase: string | null
  ofsted_grade: string | null
  distance_km: number
}

function floodBadgeClasses(level: string | null | undefined) {
  const v = (level || '').toLowerCase()
  if (v.includes('high')) return 'bg-red-200 text-red-900'
  if (v.includes('medium')) return 'bg-amber-200 text-amber-900'
  if (v.includes('low')) return 'bg-green-200 text-green-900'
  return 'bg-gray-200 text-gray-700'
}

function gradeBadgeClasses(grade: string | null) {
  const g = (grade || '').toLowerCase()
  if (g === 'outstanding') return 'bg-purple-200 text-purple-900'
  if (g === 'good') return 'bg-green-200 text-green-900'
  if (g.includes('requires')) return 'bg-amber-200 text-amber-900'
  if (g === 'inadequate') return 'bg-red-200 text-red-900'
  return 'bg-gray-200 text-gray-700'
}

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
  const [schools, setSchools] = useState<NearbySchool[] | null>(null)

  useEffect(() => {
    if (!district) return
    setLoading(true)
    getAreaSummary(district)
      .then(setArea)
      .catch(() => setArea(null))
      .finally(() => { setLoading(false); setTried(true) })
  }, [district])

  useEffect(() => {
    if (variant !== 'full' || !area || area.lat == null || area.lng == null) return
    let cancelled = false
    fetch(
      `${API_URL}/api/v1/overlays/schools/near?lat=${area.lat}&lng=${area.lng}&radius_km=2`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return
        setSchools(Array.isArray(j.data) ? j.data.slice(0, 5) : [])
      })
      .catch((err) => { console.error('Failed to load nearby schools:', err) })
    return () => {
      cancelled = true
    }
  }, [variant, area])

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
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              area.family_score >= 80
                ? 'bg-green-200 text-green-900'
                : area.family_score >= 60
                  ? 'bg-amber-200 text-amber-900'
                  : 'bg-red-200 text-red-900'
            }`}
          >
            Family score {area.family_score}/100
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

      {variant === 'full' && area?.family_score_breakdown && (
        <div className="mt-3 pt-3 border-t border-purple-200">
          <p className="text-xs text-purple-700 uppercase mb-2 font-semibold">
            Family score breakdown
          </p>
          <div className="space-y-1.5">
            {(
              [
                ['Nurseries', 'nursery'],
                ['Crime', 'crime'],
                ['Deprivation', 'deprivation'],
                ['Affordability', 'affordability'],
              ] as const
            ).map(([label, key]) => {
              const raw = (area.family_score_breakdown as Record<string, unknown>)?.[key]
              const value = typeof raw === 'number' ? raw : null
              return (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-purple-700">{label}</span>
                  <div className="flex-1 h-2 bg-purple-100 rounded-full overflow-hidden">
                    {value != null && (
                      <div
                        className={`h-full ${
                          value >= 80
                            ? 'bg-green-500'
                            : value >= 60
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                      />
                    )}
                  </div>
                  <span className="w-10 text-right font-medium text-purple-900">
                    {value != null ? Math.round(value) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {variant === 'full' && (
        <div className="mt-3 pt-3 border-t border-purple-200 space-y-3">
          <div>
            <p className="text-xs text-purple-700 uppercase mb-1 font-semibold">Flood risk</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${floodBadgeClasses(area?.flood_risk_level)}`}
              >
                {area?.flood_risk_level || 'Unknown'}
              </span>
              {area?.flood_updated_at && (
                <span className="text-xs text-purple-700">
                  Updated {new Date(area.flood_updated_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {(area?.nearest_park_name || area?.park_count_within_1km != null) && (
            <div>
              <p className="text-xs text-purple-700 uppercase mb-1 font-semibold">Parks & greenspace</p>
              {area?.nearest_park_name && (
                <p className="text-sm text-purple-900">
                  Nearest: <span className="font-medium">{area.nearest_park_name}</span>
                  {area.nearest_park_distance_m != null
                    ? ` (${area.nearest_park_distance_m}m)`
                    : ''}
                </p>
              )}
              {area?.park_count_within_1km != null && (
                <p className="text-xs text-purple-700">
                  {area.park_count_within_1km} parks within 1km
                </p>
              )}
            </div>
          )}

          {schools && schools.length > 0 && (
            <div>
              <p className="text-xs text-purple-700 uppercase mb-1 font-semibold">Nearest schools</p>
              <ul className="space-y-1">
                {schools.map((s) => (
                  <li key={s.urn} className="flex items-center gap-2 text-sm">
                    <span className="text-purple-900 flex-1 truncate">{s.name}</span>
                    {s.phase && (
                      <span className="text-xs text-purple-700">{s.phase}</span>
                    )}
                    {s.ofsted_grade && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${gradeBadgeClasses(s.ofsted_grade)}`}
                      >
                        {s.ofsted_grade}
                      </span>
                    )}
                    <span className="text-xs text-purple-700">{s.distance_km}km</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
