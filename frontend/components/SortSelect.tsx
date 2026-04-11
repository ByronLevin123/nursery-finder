'use client'

export type SortOption = 'relevance' | 'distance' | 'score' | 'cost_low' | 'cost_high' | 'rating'

interface Props {
  value: SortOption
  onChange: (value: SortOption) => void
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'distance', label: 'Nearest first' },
  { value: 'score', label: 'Highest rated' },
  { value: 'cost_low', label: 'Lowest cost' },
  { value: 'cost_high', label: 'Highest cost' },
  { value: 'rating', label: 'Best Google rating' },
]

export default function SortSelect({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Sort by</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
