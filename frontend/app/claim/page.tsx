'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { API_URL, Nursery } from '@/lib/api'
import OglAttribution from '@/components/OglAttribution'

export default function ClaimPage() {
  const searchParams = useSearchParams()
  const prefilledUrn = searchParams.get('urn') || ''

  const [query, setQuery] = useState(prefilledUrn)
  const [results, setResults] = useState<Nursery[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setSearched(true)
    try {
      // Try searching by URN first if it looks like one, otherwise by name/postcode
      const isUrn = /^\d{5,}$/.test(query.trim())
      let data: Nursery[] = []

      if (isUrn) {
        const res = await fetch(`${API_URL}/api/v1/nurseries/${encodeURIComponent(query.trim())}`)
        if (res.ok) {
          const nursery = await res.json()
          data = [nursery]
        }
      }

      if (data.length === 0) {
        // Search by name via autocomplete or search
        const res = await fetch(
          `${API_URL}/api/v1/nurseries/autocomplete?q=${encodeURIComponent(query.trim())}`
        )
        if (res.ok) {
          const suggestions = await res.json()
          const urns = (suggestions.suggestions || [])
            .filter((s: any) => s.type === 'nursery' && s.urn)
            .slice(0, 10)
            .map((s: any) => s.urn)

          if (urns.length > 0) {
            const compareRes = await fetch(`${API_URL}/api/v1/nurseries/compare`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ urns }),
            })
            if (compareRes.ok) {
              const compareData = await compareRes.json()
              data = compareData.data || []
            }
          }
        }

        // Fallback: try postcode search
        if (data.length === 0) {
          const searchRes = await fetch(`${API_URL}/api/v1/nurseries/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postcode: query.trim(), radius_km: 3 }),
          })
          if (searchRes.ok) {
            const searchData = await searchRes.json()
            data = searchData.data || []
          }
        }
      }

      setResults(data.slice(0, 20))
    } catch (err: any) {
      setError(err.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Claim your nursery</h1>
          <p className="text-gray-500">
            Search by nursery name, URN, or postcode to find and claim your listing.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3 mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Sunshine Nursery, EJ123456, or SW1A 1AA"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {searched && !loading && results.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg font-medium mb-2">No nurseries found</p>
            <p className="text-sm">Try a different name, URN, or postcode.</p>
          </div>
        )}

        <div className="space-y-4">
          {results.map((n) => (
            <div
              key={n.urn}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/nursery/${n.urn}`}
                    className="text-lg font-bold text-gray-900 hover:text-blue-600 transition"
                  >
                    {n.name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
                    {n.ofsted_overall_grade && (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          n.ofsted_overall_grade === 'Outstanding'
                            ? 'bg-emerald-100 text-emerald-700'
                            : n.ofsted_overall_grade === 'Good'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {n.ofsted_overall_grade}
                      </span>
                    )}
                    {n.town && <span>{n.town}</span>}
                    {n.postcode && <span>{n.postcode}</span>}
                  </div>
                  {n.claimed_by_user_id && (
                    <p className="text-xs text-amber-600 font-medium mt-1">Already claimed</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {n.claimed_by_user_id ? (
                    <span className="inline-block px-4 py-2 bg-gray-100 text-gray-400 text-sm font-semibold rounded-lg cursor-not-allowed">
                      Claimed
                    </span>
                  ) : (
                    <Link
                      href={`/nursery/${n.urn}?claim=true`}
                      className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
                    >
                      Claim this nursery
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <OglAttribution />
        </div>
      </div>
    </main>
  )
}
