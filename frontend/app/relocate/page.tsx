'use client'

import { useState } from 'react'
import Link from 'next/link'
import { API_URL } from '@/lib/api'
import { trackEvent } from '@/lib/analytics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommuteInfo {
  postcode: string
  minutes: number
  distance_km: number
}

interface MatchResult {
  district: string
  local_authority: string | null
  region: string | null
  lat: number
  lng: number
  property: {
    avg_price: number | null
    avg_price_flat: number | null
    avg_price_terraced: number | null
    avg_price_semi: number | null
    avg_price_detached: number | null
    price_trend_1yr_pct: number | null
  }
  nursery_summary: {
    count: number
    total_nearby: number
    best_grade: string
    avg_monthly_fee: number | null
  }
  school_summary: {
    count: number
    total_nearby: number
    best_rating: string
  }
  area_data: {
    crime_rate_per_1000: number | null
    imd_decile: number | null
    flood_risk_level: string | null
    family_score: number | null
    park_count: number | null
  }
  commutes: CommuteInfo[]
  scores: {
    nursery: number
    school: number
    affordability: number
    safety: number
    commute: number
    green_space: number
    flood_safety: number
  }
  match_score: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(price: number | null): string {
  if (price == null) return 'N/A'
  if (price >= 1_000_000) return `£${(price / 1_000_000).toFixed(1)}m`
  return `£${Math.round(price / 1000)}k`
}

function gradeBadgeColor(grade: string): string {
  switch (grade) {
    case 'Outstanding':
      return 'bg-green-100 text-green-800'
    case 'Good':
      return 'bg-blue-100 text-blue-800'
    case 'Requires Improvement':
      return 'bg-yellow-100 text-yellow-800'
    case 'Inadequate':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

function scoreBadgeColor(score: number): string {
  if (score >= 75) return 'bg-green-600'
  if (score >= 50) return 'bg-blue-600'
  if (score >= 25) return 'bg-yellow-500'
  return 'bg-red-500'
}

function floodBadge(level: string | null): string {
  if (!level) return 'bg-gray-100 text-gray-600'
  switch (level) {
    case 'Very Low':
      return 'bg-green-100 text-green-800'
    case 'Low':
      return 'bg-blue-100 text-blue-800'
    case 'Medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'High':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RelocatePage() {
  // Form state
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [childAgesInput, setChildAgesInput] = useState('')
  const [workPostcode1, setWorkPostcode1] = useState('')
  const [workPostcode2, setWorkPostcode2] = useState('')
  const [maxCommute, setMaxCommute] = useState('30')
  const [region, setRegion] = useState('')
  const [minGrade, setMinGrade] = useState('Good')
  const [fundedHours, setFundedHours] = useState(false)
  const [schoolPhase, setSchoolPhase] = useState('Primary')
  const [minSchoolRating, setMinSchoolRating] = useState('Good')
  const [lowCrime, setLowCrime] = useState(true)
  const [greenSpace, setGreenSpace] = useState(false)
  const [floodSafe, setFloodSafe] = useState(false)

  // Results state
  const [results, setResults] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  async function handleSearch() {
    const maxVal = Number(budgetMax)
    if (!maxVal) {
      setError('Please enter a maximum property budget')
      return
    }

    // Parse child ages: accept comma-separated months or years
    const ageTokens = childAgesInput
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    const childAges = ageTokens.map((t) => {
      const n = Number(t)
      // If user enters small numbers (1-5) treat as years, convert to months
      return n <= 5 ? n * 12 : n
    })
    if (childAges.length === 0) {
      setError('Please enter at least one child age')
      return
    }

    const workPostcodes = [workPostcode1, workPostcode2]
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean)

    setLoading(true)
    setError('')
    setSearched(true)
    setExpandedIdx(null)

    try {
      const body = {
        budget_min: Number(budgetMin) || 0,
        budget_max: maxVal,
        child_ages: childAges,
        work_postcodes: workPostcodes,
        max_commute_min: Number(maxCommute),
        region: region || undefined,
        nursery_requirements: {
          min_grade: minGrade,
          funded_hours: fundedHours,
        },
        school_requirements: {
          phase: schoolPhase || undefined,
          min_rating: minSchoolRating,
        },
        preferences: {
          low_crime: lowCrime,
          green_space: greenSpace,
          flood_safe: floodSafe,
        },
      }

      const res = await fetch(`${API_URL}/api/v1/areas/family-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Search failed (${res.status})`)
      }

      const json = await res.json()
      setResults(json.data || [])

      trackEvent('Search' as any, { type: 'family_relocation', results: json.data?.length || 0 })
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Where Should Your Family Live?</h1>
        <p className="text-gray-600 text-lg">
          Find the best areas based on nursery quality, schools, property prices, commute times, and
          neighbourhood safety. Powered by Ofsted, Land Registry, and police data.
        </p>
      </div>

      <div className="lg:flex lg:gap-8">
        {/* Form Panel */}
        <div className="lg:w-96 flex-shrink-0 mb-8 lg:mb-0">
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5 sticky top-20">
            {/* Budget */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property budget
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="Min (optional)"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="Max *"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Average sale price in the area</p>
            </div>

            {/* Child ages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Child ages (years)
              </label>
              <input
                type="text"
                placeholder="e.g. 2, 4"
                value={childAgesInput}
                onChange={(e) => setChildAgesInput(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Comma-separated, in years</p>
            </div>

            {/* Work postcodes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work postcodes
              </label>
              <input
                type="text"
                placeholder="e.g. EC2R 8AH"
                value={workPostcode1}
                onChange={(e) => setWorkPostcode1(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Partner's postcode (optional)"
                value={workPostcode2}
                onChange={(e) => setWorkPostcode2(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Max commute */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max commute</label>
              <select
                value={maxCommute}
                onChange={(e) => setMaxCommute(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="15">15 minutes</option>
                <option value="20">20 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Estimated driving time</p>
            </div>

            {/* Region */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Region (optional)
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Any region</option>
                <option value="London">London</option>
                <option value="South East">South East</option>
                <option value="South West">South West</option>
                <option value="East of England">East of England</option>
                <option value="West Midlands">West Midlands</option>
                <option value="East Midlands">East Midlands</option>
                <option value="Yorkshire">Yorkshire and the Humber</option>
                <option value="North West">North West</option>
                <option value="North East">North East</option>
              </select>
            </div>

            {/* Divider */}
            <hr className="border-gray-200" />

            {/* Nursery preferences */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Nursery preferences</h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Minimum Ofsted grade</label>
                  <select
                    value={minGrade}
                    onChange={(e) => setMinGrade(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Outstanding">Outstanding only</option>
                    <option value="Good">Good or better</option>
                    <option value="Requires Improvement">Any rated</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={fundedHours}
                    onChange={(e) => setFundedHours(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Must accept funded hours
                </label>
              </div>
            </div>

            {/* School preferences */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">School preferences</h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Phase</label>
                  <select
                    value={schoolPhase}
                    onChange={(e) => setSchoolPhase(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary</option>
                    <option value="">Any</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Minimum rating</label>
                  <select
                    value={minSchoolRating}
                    onChange={(e) => setMinSchoolRating(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Outstanding">Outstanding only</option>
                    <option value="Good">Good or better</option>
                    <option value="Requires Improvement">Any rated</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Area preferences */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Area preferences</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={lowCrime}
                    onChange={(e) => setLowCrime(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Low crime area
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={greenSpace}
                    onChange={(e) => setGreenSpace(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Green space nearby
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={floodSafe}
                    onChange={(e) => setFloodSafe(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Low flood risk
                </label>
              </div>
            </div>

            {/* Search button */}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Find areas'}
            </button>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm rounded-md px-3 py-2">{error}</div>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="flex-1 min-w-0">
          {!searched && !loading && (
            <div className="text-center py-16 text-gray-400">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"
                />
              </svg>
              <p className="text-lg font-medium text-gray-500">Set your preferences and search</p>
              <p className="text-sm mt-1">
                We will rank UK areas by how well they match your family's needs
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-16">
              <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
              <p className="text-gray-500">Analysing areas across the UK...</p>
              <p className="text-sm text-gray-400 mt-1">
                Checking nurseries, schools, prices, and commute times
              </p>
            </div>
          )}

          {searched && !loading && results.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg font-medium">No matching areas found</p>
              <p className="text-sm mt-1">
                Try increasing your budget, extending your max commute, or removing some filters.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                {results.length} area{results.length !== 1 ? 's' : ''} match your criteria, ranked
                by overall score
              </p>

              <div className="space-y-4">
                {results.map((r, idx) => (
                  <div
                    key={r.district}
                    className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition"
                  >
                    {/* Card header */}
                    <button
                      onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                      className="w-full text-left p-4 sm:p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-semibold text-gray-400">
                              #{idx + 1}
                            </span>
                            <h3 className="text-lg font-bold text-gray-900">{r.district}</h3>
                            <span
                              className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-sm ${scoreBadgeColor(r.match_score)}`}
                            >
                              {r.match_score}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {r.local_authority}
                            {r.region ? ` • ${r.region}` : ''}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-bold text-gray-900">
                            {formatPrice(r.property.avg_price)}
                          </div>
                          <div className="text-xs text-gray-400">avg property price</div>
                        </div>
                      </div>

                      {/* Quick stats row */}
                      <div className="flex flex-wrap gap-3 mt-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${gradeBadgeColor(r.nursery_summary.best_grade)}`}
                        >
                          {r.nursery_summary.count} nurseries ({r.nursery_summary.best_grade})
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${gradeBadgeColor(r.school_summary.best_rating)}`}
                        >
                          {r.school_summary.count} schools ({r.school_summary.best_rating})
                        </span>
                        {r.commutes.map((c) => (
                          <span
                            key={c.postcode}
                            className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700"
                          >
                            {c.minutes} min to {c.postcode}
                          </span>
                        ))}
                        {r.area_data.flood_risk_level && (
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${floodBadge(r.area_data.flood_risk_level)}`}
                          >
                            Flood: {r.area_data.flood_risk_level}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {expandedIdx === idx && (
                      <div className="border-t border-gray-100 px-4 sm:px-5 py-4 bg-gray-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Score breakdown */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                              Score breakdown
                            </h4>
                            <div className="space-y-1.5">
                              {[
                                { label: 'Nursery quality', value: r.scores.nursery, weight: '30%' },
                                { label: 'School quality', value: r.scores.school, weight: '20%' },
                                { label: 'Affordability', value: r.scores.affordability, weight: '15%' },
                                { label: 'Safety', value: r.scores.safety, weight: '15%' },
                                { label: 'Commute', value: r.scores.commute, weight: '10%' },
                                { label: 'Green space', value: r.scores.green_space, weight: '5%' },
                                { label: 'Flood safety', value: r.scores.flood_safety, weight: '5%' },
                              ].map((s) => (
                                <div key={s.label} className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 w-24 flex-shrink-0">
                                    {s.label}
                                  </span>
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${s.value >= 60 ? 'bg-green-500' : s.value >= 30 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                      style={{ width: `${s.value}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-600 w-8 text-right">
                                    {s.value}
                                  </span>
                                  <span className="text-xs text-gray-400 w-8">{s.weight}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Property details */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                              Property prices
                            </h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Flat</span>
                                <span className="font-medium">
                                  {formatPrice(r.property.avg_price_flat)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Terraced</span>
                                <span className="font-medium">
                                  {formatPrice(r.property.avg_price_terraced)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Semi-detached</span>
                                <span className="font-medium">
                                  {formatPrice(r.property.avg_price_semi)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Detached</span>
                                <span className="font-medium">
                                  {formatPrice(r.property.avg_price_detached)}
                                </span>
                              </div>
                              {r.property.price_trend_1yr_pct != null && (
                                <div className="flex justify-between pt-1 border-t border-gray-200">
                                  <span className="text-gray-500">1yr trend</span>
                                  <span
                                    className={`font-medium ${r.property.price_trend_1yr_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}
                                  >
                                    {r.property.price_trend_1yr_pct >= 0 ? '+' : ''}
                                    {r.property.price_trend_1yr_pct.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Area stats */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                              Area statistics
                            </h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Crime rate</span>
                                <span className="font-medium">
                                  {r.area_data.crime_rate_per_1000 != null
                                    ? `${r.area_data.crime_rate_per_1000.toFixed(0)} per 1k`
                                    : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Deprivation</span>
                                <span className="font-medium">
                                  {r.area_data.imd_decile != null
                                    ? `Decile ${r.area_data.imd_decile}/10`
                                    : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Parks nearby</span>
                                <span className="font-medium">
                                  {r.area_data.park_count ?? 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Family score</span>
                                <span className="font-medium">
                                  {r.area_data.family_score != null
                                    ? `${r.area_data.family_score}/100`
                                    : 'N/A'}
                                </span>
                              </div>
                              {r.nursery_summary.avg_monthly_fee != null && r.nursery_summary.avg_monthly_fee > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Avg nursery fee</span>
                                  <span className="font-medium">
                                    {'£'}{r.nursery_summary.avg_monthly_fee}/mo
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action links */}
                        <div className="mt-4 pt-3 border-t border-gray-200 flex flex-wrap gap-3">
                          <Link
                            href={`/nurseries-in/${r.district.toLowerCase()}`}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View nurseries in {r.district}
                          </Link>
                          <Link
                            href={`/find-an-area?district=${r.district}`}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Full area profile
                          </Link>
                          <Link
                            href={`/property-search?district=${r.district}`}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Property search
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
