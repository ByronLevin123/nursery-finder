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
  { v: 'all', l: 'Any' },
  { v: 'flat', l: 'Flat' },
  { v: 'terraced', l: 'Terraced' },
  { v: 'semi', l: 'Semi' },
  { v: 'detached', l: 'Detached' },
]

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return '£' + Math.round(n).toLocaleString()
}

export default function PropertySearchPage() {
  const [propertyType, setPropertyType] = useState('all')
  const [maxPrice, setMaxPrice] = useState('')
  const [minPrice, setMinPrice] = useState('')
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
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Find an area to buy or rent</h1>
      <p className="text-gray-600 mb-2">
        Browse UK postcode districts ranked by family score, sold prices, and nursery quality.
      </p>
      <p className="text-xs text-gray-500 mb-8">
        Sold price data: HM Land Registry. Want individual listings? Try{' '}
        <Link href="/assistant" className="text-indigo-600 underline">
          the AI assistant
        </Link>{' '}
        for a guided search.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          load()
        }}
        className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Property type</label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {PROPERTY_TYPES.map((p) => (
                <option key={p.v} value={p.v}>
                  {p.l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Min £</label>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Max £</label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sort by</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="family_score">Family Score</option>
              <option value="price_asc">Cheapest first</option>
              <option value="price_desc">Most expensive first</option>
              <option value="yield">Highest yield</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="text-sm text-gray-600 mb-4">{results.length} districts</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((d) => (
          <Link
            key={d.postcode_district}
            href={`/nurseries-in/${d.postcode_district}`}
            className="block bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-lg font-bold text-gray-900">{d.postcode_district}</div>
                <div className="text-xs text-gray-500">{d.local_authority || d.region || ''}</div>
              </div>
              {d.family_score != null && (
                <span className="text-xs font-semibold px-2 py-1 rounded bg-indigo-50 text-indigo-700">
                  Family {Math.round(d.family_score)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 mb-3">
              <div>
                <div className="text-gray-500">Avg sold</div>
                <div className="font-semibold">{fmt(d.price_displayed)}</div>
              </div>
              <div>
                <div className="text-gray-500">Rent/wk</div>
                <div className="font-semibold">{fmt(d.rent_avg_weekly)}</div>
              </div>
              <div>
                <div className="text-gray-500">Yield</div>
                <div className="font-semibold">
                  {d.gross_yield_pct != null ? `${d.gross_yield_pct.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Crime/1k</div>
                <div className="font-semibold">
                  {d.crime_rate_per_1000 != null ? d.crime_rate_per_1000.toFixed(1) : '—'}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-600 border-t pt-2">
              {d.nursery_count_total ?? 0} nurseries
              {d.nursery_outstanding_pct != null
                ? ` · ${Math.round(d.nursery_outstanding_pct)}% Outstanding`
                : ''}
            </div>
          </Link>
        ))}
      </div>

      {!loading && results.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          No districts match your filters. Try widening the price range.
        </div>
      )}
    </div>
  )
}
