'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { API_URL } from '@/lib/api'

interface DistrictResult {
  postcode_district: string
  local_authority: string | null
  region: string | null
  price_displayed: number | null
  rent_avg_weekly: number | null
  gross_yield_pct: number | null
  demand_rating: string | null
  price_growth_1yr_pct: number | null
  nursery_count_total: number | null
  nursery_count_outstanding: number | null
  nursery_outstanding_pct: number | null
  family_score: number | null
  crime_rate_per_1000: number | null
  imd_decile: number | null
}

const PROPERTY_TYPES = [
  { v: 'all', l: 'Any type' },
  { v: 'flat', l: 'Flat' },
  { v: 'terraced', l: 'Terraced' },
  { v: 'semi', l: 'Semi-detached' },
  { v: 'detached', l: 'Detached' },
]

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return '£' + Math.round(n).toLocaleString()
}

function scoreBg(score: number | null): string {
  if (score == null) return 'bg-gray-100 text-gray-600'
  if (score >= 75) return 'bg-green-50 text-green-700'
  if (score >= 50) return 'bg-blue-50 text-blue-700'
  if (score >= 25) return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}

export default function FindAHomePage() {
  const [propertyType, setPropertyType] = useState('all')
  const [maxPrice, setMaxPrice] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [postcode, setPostcode] = useState('')
  const [sort, setSort] = useState('family_score')
  const [results, setResults] = useState<DistrictResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ property_type: propertyType, sort, limit: '60' })
      if (minPrice) params.set('min_price', minPrice)
      if (maxPrice) params.set('max_price', maxPrice)
      if (postcode.trim()) params.set('region', postcode.trim().toUpperCase())
      const res = await fetch(`${API_URL}/api/v1/properties/districts?${params}`)
      if (!res.ok) throw new Error(`Search failed (${res.status})`)
      const json = await res.json()
      setResults(json.data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          Moving with children? Find your perfect area.
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Discover areas with great nurseries, safe streets, and affordable homes.
          Every area is scored on nursery quality, crime, and family-friendliness.
        </p>
      </div>

      {/* Search form */}
      <form
        onSubmit={(e) => { e.preventDefault(); load() }}
        className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Where are you looking?</label>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Postcode, city, or region"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Budget max</label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="e.g. 500000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Property type</label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {PROPERTY_TYPES.map((p) => (
                <option key={p.v} value={p.v}>{p.l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sort by</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="family_score">Best for families</option>
              <option value="price_asc">Most affordable</option>
              <option value="price_desc">Premium areas</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search areas'}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6 text-sm">{error}</div>
      )}

      {results.length > 0 && (
        <p className="text-sm text-gray-500 mb-4">{results.length} areas found</p>
      )}

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((d) => (
          <Link
            key={d.postcode_district}
            href={`/nurseries-in/${d.postcode_district.toLowerCase()}`}
            className="block bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-indigo-200 transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-lg font-bold text-gray-900">{d.postcode_district}</div>
                <div className="text-xs text-gray-500">{d.local_authority || d.region || ''}</div>
              </div>
              {d.family_score != null && (
                <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${scoreBg(d.family_score)}`}>
                  {Math.round(d.family_score)}
                </span>
              )}
            </div>

            {/* Key metrics */}
            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Avg property price</span>
                <span className="font-semibold text-gray-900">{fmt(d.price_displayed)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Nurseries</span>
                <span className="font-semibold text-gray-900">{d.nursery_count_total ?? 0}</span>
              </div>
              {d.nursery_count_outstanding != null && d.nursery_count_outstanding > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Outstanding nurseries</span>
                  <span className="font-semibold text-green-700">{d.nursery_count_outstanding}</span>
                </div>
              )}
              {d.crime_rate_per_1000 != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Crime rate</span>
                  <span className="font-semibold text-gray-900">{d.crime_rate_per_1000.toFixed(0)}/1k</span>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="text-xs font-medium text-indigo-600 pt-2 border-t border-gray-100">
              View nurseries in {d.postcode_district} &rarr;
            </div>
          </Link>
        ))}
      </div>

      {!loading && results.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          No areas match your search. Try a different location or widen your budget.
        </div>
      )}

      <p className="text-xs text-gray-400 mt-8 text-center">
        Property prices from HM Land Registry. Family Score combines nursery quality, crime rates, and area deprivation data.
      </p>
    </div>
  )
}
