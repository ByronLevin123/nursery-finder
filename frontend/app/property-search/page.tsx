'use client'

import { useState } from 'react'
import PropertyListingCard, { PropertyListing } from '@/components/PropertyListingCard'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

export default function PropertySearchPage() {
  const [district, setDistrict] = useState('SW11')
  const [type, setType] = useState<'sale' | 'rent'>('sale')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minBeds, setMinBeds] = useState('')
  const [results, setResults] = useState<PropertyListing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ total: number; fetched_at: string | null } | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ district, type })
      if (minPrice) params.set('min_price', minPrice)
      if (maxPrice) params.set('max_price', maxPrice)
      if (minBeds) params.set('min_beds', minBeds)
      const res = await fetch(`${API_URL}/api/v1/properties/search?${params.toString()}`)
      if (!res.ok) throw new Error(`Search failed (${res.status})`)
      const json = await res.json()
      setResults(json.data || [])
      setMeta(json.meta || null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const priceLabel = type === 'rent' ? 'Rent £/wk' : 'Price £'

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Find a home near great nurseries</h1>
      <p className="text-gray-600 mb-8">
        Search property listings by postcode district, with nursery quality overlaid on every result.
      </p>

      <form
        onSubmit={handleSearch}
        className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">District</label>
            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="e.g. SW11"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Mode</label>
            <div className="flex rounded-md overflow-hidden border border-gray-300">
              <button
                type="button"
                onClick={() => setType('sale')}
                className={`flex-1 py-2 text-sm font-medium ${
                  type === 'sale' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'
                }`}
              >
                For Sale
              </button>
              <button
                type="button"
                onClick={() => setType('rent')}
                className={`flex-1 py-2 text-sm font-medium ${
                  type === 'rent' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'
                }`}
              >
                To Rent
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Min beds</label>
            <select
              value={minBeds}
              onChange={(e) => setMinBeds(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}+
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Min {priceLabel}</label>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Max {priceLabel}</label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div className="md:col-span-3 flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Searching…' : 'Search properties'}
            </button>
          </div>
        </div>
      </form>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6 text-sm">
          {error}
        </div>
      ) : null}

      {meta ? (
        <div className="text-sm text-gray-600 mb-4">
          {meta.total} result{meta.total === 1 ? '' : 's'}
          {meta.fetched_at ? ` · updated ${new Date(meta.fetched_at).toLocaleString()}` : ''}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((listing) => (
          <PropertyListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      {!loading && results.length === 0 && meta ? (
        <div className="text-center text-gray-500 py-12">
          No listings found. Try a wider price range or another district.
        </div>
      ) : null}
    </div>
  )
}
