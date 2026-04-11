'use client'

import { useState } from 'react'

export interface SearchFilterValues {
  grade: string | null
  has_availability: boolean
  min_rating: number | null
  provider_type: string | null
  has_funded_2yr: boolean
  has_funded_3yr: boolean
}

export const DEFAULT_FILTERS: SearchFilterValues = {
  grade: null,
  has_availability: false,
  min_rating: null,
  provider_type: null,
  has_funded_2yr: false,
  has_funded_3yr: false,
}

export function countActiveFilters(f: SearchFilterValues): number {
  let count = 0
  if (f.grade) count++
  if (f.has_availability) count++
  if (f.min_rating) count++
  if (f.provider_type) count++
  if (f.has_funded_2yr) count++
  if (f.has_funded_3yr) count++
  return count
}

const PROVIDER_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'Childcare on non-domestic premises', label: 'Nursery' },
  { value: 'Childminder', label: 'Childminder' },
  { value: 'Childcare on domestic premises', label: 'Pre-school' },
]

const MIN_RATING_OPTIONS = [
  { value: '', label: 'Any rating' },
  { value: '3', label: '3+ stars' },
  { value: '4', label: '4+ stars' },
  { value: '4.5', label: '4.5+ stars' },
]

interface SearchFiltersProps {
  filters: SearchFilterValues
  onChange: (filters: SearchFilterValues) => void
}

export default function SearchFilters({ filters, onChange }: SearchFiltersProps) {
  const [expanded, setExpanded] = useState(false)
  const activeCount = countActiveFilters(filters)

  function update(partial: Partial<SearchFilterValues>) {
    onChange({ ...filters, ...partial })
  }

  function clearAll() {
    onChange({ ...DEFAULT_FILTERS })
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
      >
        <span>
          Filters
          {activeCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
              {activeCount}
            </span>
          )}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Ofsted Grade */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Ofsted grade</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {['Outstanding', 'Good', 'Requires Improvement'].map((g) => (
                <label key={g} className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={filters.grade === g}
                    onChange={(e) => update({ grade: e.target.checked ? g : null })}
                    className="rounded border-gray-300"
                  />
                  {g}
                </label>
              ))}
            </div>
          </div>

          {/* Availability toggle */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={filters.has_availability}
                onChange={(e) => update({ has_availability: e.target.checked })}
                className="rounded border-gray-300"
              />
              Only show nurseries with spots available
            </label>
          </div>

          {/* Google Rating */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Minimum Google rating</label>
            <select
              value={filters.min_rating?.toString() || ''}
              onChange={(e) => update({ min_rating: e.target.value ? Number(e.target.value) : null })}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {MIN_RATING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Provider Type */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Provider type</label>
            <select
              value={filters.provider_type || ''}
              onChange={(e) => update({ provider_type: e.target.value || null })}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {PROVIDER_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Funded places */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Funded places</label>
            <div className="flex flex-col gap-2 mt-1">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filters.has_funded_2yr}
                  onChange={(e) => update({ has_funded_2yr: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Funded 2-year-old places
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filters.has_funded_3yr}
                  onChange={(e) => update({ has_funded_3yr: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Funded 3-4-year-old places
              </label>
            </div>
          </div>

          {/* Clear all */}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
