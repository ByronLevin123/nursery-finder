'use client'

import type { AssistantCriteria } from '@/lib/api'

type PriorityLevel = 'required' | 'priority' | 'nice' | null

interface Props {
  criteria: AssistantCriteria
  onChange: (next: AssistantCriteria) => void
}

const PRIORITY_LABELS: Record<string, string> = {
  nursery_quality: 'Nursery quality',
  low_crime: 'Low crime',
  low_deprivation: 'Low deprivation',
  affordability: 'Affordability',
}

const LEVEL_COLORS: Record<string, string> = {
  required: 'bg-red-100 text-red-800 border-red-200',
  priority: 'bg-amber-100 text-amber-800 border-amber-200',
  nice: 'bg-blue-100 text-blue-800 border-blue-200',
}

const LEVEL_DOT: Record<string, string> = {
  required: 'bg-red-500',
  priority: 'bg-amber-500',
  nice: 'bg-blue-500',
}

function nextLevel(current: PriorityLevel): PriorityLevel {
  if (current == null) return 'nice'
  if (current === 'nice') return 'priority'
  if (current === 'priority') return 'required'
  return null
}

export default function CriteriaChips({ criteria, onChange }: Props) {
  function removeArea(key: 'postcode' | 'district' | 'region' | 'max_distance_km') {
    onChange({ ...criteria, area: { ...criteria.area, [key]: null } })
  }

  function removeBudget(key: 'type' | 'min' | 'max') {
    onChange({ ...criteria, budget: { ...criteria.budget, [key]: null } })
  }

  function cyclePriority(key: keyof AssistantCriteria['priorities']) {
    onChange({
      ...criteria,
      priorities: { ...criteria.priorities, [key]: nextLevel(criteria.priorities[key]) },
    })
  }

  function removeCommute() {
    onChange({ ...criteria, commute: { to_postcode: null, max_minutes: null, mode: null } })
  }

  function removeNote(i: number) {
    const notes = criteria.notes.filter((_, idx) => idx !== i)
    onChange({ ...criteria, notes })
  }

  const areaChips: { label: string; onRemove: () => void }[] = []
  if (criteria.area.postcode)
    areaChips.push({ label: `📍 ${criteria.area.postcode}`, onRemove: () => removeArea('postcode') })
  if (criteria.area.district)
    areaChips.push({ label: `District ${criteria.area.district}`, onRemove: () => removeArea('district') })
  if (criteria.area.region)
    areaChips.push({ label: criteria.area.region, onRemove: () => removeArea('region') })
  if (criteria.area.max_distance_km)
    areaChips.push({
      label: `≤ ${criteria.area.max_distance_km}km`,
      onRemove: () => removeArea('max_distance_km'),
    })

  const budgetChips: { label: string; onRemove: () => void }[] = []
  if (criteria.budget.type)
    budgetChips.push({ label: criteria.budget.type === 'sale' ? 'Buying' : 'Renting', onRemove: () => removeBudget('type') })
  if (criteria.budget.max)
    budgetChips.push({
      label: `Max £${criteria.budget.max.toLocaleString()}`,
      onRemove: () => removeBudget('max'),
    })
  if (criteria.budget.min)
    budgetChips.push({
      label: `Min £${criteria.budget.min.toLocaleString()}`,
      onRemove: () => removeBudget('min'),
    })
  if (criteria.bedrooms.min)
    budgetChips.push({
      label: `${criteria.bedrooms.min}+ beds`,
      onRemove: () => onChange({ ...criteria, bedrooms: { min: null } }),
    })

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 h-full min-h-[480px] overflow-y-auto">
      <h2 className="font-semibold text-gray-900 mb-1">Your criteria</h2>
      <p className="text-xs text-gray-500 mb-4">Click priorities to cycle nice → priority → required → off</p>

      <section className="mb-4">
        <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Area</h3>
        <div className="flex flex-wrap gap-1.5">
          {areaChips.length === 0 && <p className="text-xs text-gray-400 italic">None set</p>}
          {areaChips.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs text-gray-700"
            >
              {c.label}
              <button
                onClick={c.onRemove}
                className="text-gray-400 hover:text-red-500 ml-0.5"
                aria-label="remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Budget</h3>
        <div className="flex flex-wrap gap-1.5">
          {budgetChips.length === 0 && <p className="text-xs text-gray-400 italic">None set</p>}
          {budgetChips.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs text-gray-700"
            >
              {c.label}
              <button
                onClick={c.onRemove}
                className="text-gray-400 hover:text-red-500 ml-0.5"
                aria-label="remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Priorities</h3>
        <div className="space-y-1.5">
          {(Object.keys(PRIORITY_LABELS) as (keyof AssistantCriteria['priorities'])[]).map((k) => {
            const level = criteria.priorities[k]
            const color = level ? LEVEL_COLORS[level] : 'bg-gray-50 text-gray-500 border-gray-200'
            return (
              <button
                key={k}
                onClick={() => cyclePriority(k)}
                className={`w-full flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs font-medium ${color} hover:shadow-sm transition`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${level ? LEVEL_DOT[level] : 'bg-gray-300'}`}
                  />
                  {PRIORITY_LABELS[k]}
                </span>
                <span className="text-[10px] uppercase tracking-wide">
                  {level || 'off'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="mb-4">
        <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Commute</h3>
        <div className="flex flex-wrap gap-1.5">
          {criteria.commute?.to_postcode ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-800">
              🚗 ≤{criteria.commute.max_minutes ?? '?'}min to {criteria.commute.to_postcode}
              {criteria.commute.mode ? ` (${criteria.commute.mode})` : ''}
              <button
                onClick={removeCommute}
                className="text-indigo-400 hover:text-red-500 ml-0.5"
                aria-label="remove commute"
              >
                ×
              </button>
            </span>
          ) : (
            <p className="text-xs text-gray-400 italic">None set</p>
          )}
        </div>
        {criteria.commute?.mode === 'drive' && (
          <p className="text-[11px] text-gray-400 mt-1">
            Note: we only support walk/cycle/drive routing — transit is estimated as drive time.
          </p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Notes</h3>
        <div className="flex flex-wrap gap-1.5">
          {criteria.notes.length === 0 && <p className="text-xs text-gray-400 italic">None</p>}
          {criteria.notes.map((n, i) => (
            <span
              key={i}
              title="Noted but not scored yet"
              className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs text-gray-600"
            >
              ⚠️ {n}
              <button
                onClick={() => removeNote(i)}
                className="text-gray-400 hover:text-red-500 ml-0.5"
                aria-label="remove note"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
