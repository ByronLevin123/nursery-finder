'use client'

import { useState } from 'react'
import { Preferences, DEFAULT_PREFERENCES } from '@/lib/preferences'

interface Props {
  value: Preferences
  onChange: (p: Preferences) => void
  onClear?: () => void
}

interface SectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center py-2.5 text-left"
      >
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <span className="text-gray-400 text-xs">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="pb-3 space-y-2">{children}</div>}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-gray-700">
      <span>{label}</span>
      <span>{children}</span>
    </label>
  )
}

export default function PreferencesPanel({ value, onChange, onClear }: Props) {
  function patch(p: Partial<Preferences>) {
    onChange({ ...value, ...p })
  }
  function patchWeights(w: Partial<Preferences['weights']>) {
    onChange({ ...value, weights: { ...value.weights, ...w } })
  }

  const numberInput =
    'w-20 px-2 py-1 border border-gray-300 rounded text-xs text-right focus:border-indigo-500 focus:outline-none'
  const select =
    'px-2 py-1 border border-gray-300 rounded text-xs focus:border-indigo-500 focus:outline-none bg-white'

  return (
    <div className="bg-white rounded-lg border border-indigo-200">
      <div className="px-3 py-2.5 border-b border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-lg">
        <h3 className="text-sm font-bold text-indigo-900">What matters to you?</h3>
        <p className="text-[11px] text-indigo-700">Re-ranks results to your priorities</p>
      </div>
      <div className="px-3">
        <Section title="Quality">
          <Row label="Minimum grade">
            <select
              value={value.minGrade}
              onChange={e => patch({ minGrade: e.target.value as any })}
              className={select}
            >
              <option value="any">Any</option>
              <option value="Good">Good or better</option>
              <option value="Outstanding">Outstanding only</option>
            </select>
          </Row>
          <Row label="Exclude enforcement notices">
            <input
              type="checkbox"
              checked={value.excludeEnforcement}
              onChange={e => patch({ excludeEnforcement: e.target.checked })}
              className="rounded text-indigo-600"
            />
          </Row>
          <Row label="Inspection within">
            <select
              value={value.maxInspectionYears}
              onChange={e => patch({ maxInspectionYears: Number(e.target.value) })}
              className={select}
            >
              <option value={2}>2 years</option>
              <option value={4}>4 years</option>
              <option value={6}>6 years</option>
              <option value={99}>any</option>
            </select>
          </Row>
        </Section>

        <Section title="Funded places">
          <Row label="Funded 2yr places needed">
            <input
              type="checkbox"
              checked={value.needsFunded2yr}
              onChange={e => patch({ needsFunded2yr: e.target.checked })}
              className="rounded text-indigo-600"
            />
          </Row>
          <Row label="Funded 3-4yr places needed">
            <input
              type="checkbox"
              checked={value.needsFunded3_4yr}
              onChange={e => patch({ needsFunded3_4yr: e.target.checked })}
              className="rounded text-indigo-600"
            />
          </Row>
          <Row label="Min total places">
            <input
              type="number"
              min={0}
              value={value.minTotalPlaces}
              onChange={e => patch({ minTotalPlaces: Number(e.target.value) || 0 })}
              className={numberInput}
            />
          </Row>
        </Section>

        <Section title="Budget" defaultOpen={false}>
          <Row label="Max £/month">
            <input
              type="number"
              min={0}
              step={50}
              value={value.maxMonthlyFee ?? ''}
              placeholder="any"
              onChange={e => patch({ maxMonthlyFee: e.target.value ? Number(e.target.value) : null })}
              className={numberInput}
            />
          </Row>
        </Section>

        <Section title="Location" defaultOpen={false}>
          <Row label="Max distance (km)">
            <input
              type="number"
              min={0}
              step={1}
              value={value.maxDistanceKm ?? ''}
              placeholder="any"
              onChange={e => patch({ maxDistanceKm: e.target.value ? Number(e.target.value) : null })}
              className={numberInput}
            />
          </Row>
          <Row label="Min family score">
            <input
              type="number"
              min={0}
              max={100}
              value={value.minFamilyScore}
              onChange={e => patch({ minFamilyScore: Number(e.target.value) || 0 })}
              className={numberInput}
            />
          </Row>
          <Row label="Max crime / 1000">
            <input
              type="number"
              min={0}
              value={value.maxCrimeRate ?? ''}
              placeholder="any"
              onChange={e => patch({ maxCrimeRate: e.target.value ? Number(e.target.value) : null })}
              className={numberInput}
            />
          </Row>
          <Row label="Min IMD decile (1-10)">
            <input
              type="number"
              min={1}
              max={10}
              value={value.minImdDecile}
              onChange={e => patch({ minImdDecile: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
              className={numberInput}
            />
          </Row>
        </Section>

        <Section title="Reviews" defaultOpen={false}>
          <Row label="Require parent reviews">
            <input
              type="checkbox"
              checked={value.requireReviews}
              onChange={e => patch({ requireReviews: e.target.checked })}
              className="rounded text-indigo-600"
            />
          </Row>
          <Row label="Min avg rating (0-5)">
            <input
              type="number"
              min={0}
              max={5}
              step={0.5}
              value={value.minAvgRating}
              onChange={e => patch({ minAvgRating: Number(e.target.value) || 0 })}
              className={numberInput}
            />
          </Row>
          <Row label="Min recommend %">
            <input
              type="number"
              min={0}
              max={100}
              value={value.minRecommendPct}
              onChange={e => patch({ minRecommendPct: Number(e.target.value) || 0 })}
              className={numberInput}
            />
          </Row>
        </Section>

        <Section title="Weights (1 = low, 5 = high)">
          {(['quality', 'places', 'budget', 'location', 'reviews'] as const).map(k => (
            <div key={k} className="text-xs text-gray-700">
              <div className="flex justify-between">
                <span className="capitalize">{k}</span>
                <span className="text-indigo-700 font-semibold">{value.weights[k]}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={value.weights[k]}
                onChange={e => patchWeights({ [k]: Number(e.target.value) } as any)}
                className="w-full accent-indigo-600"
              />
            </div>
          ))}
        </Section>
      </div>

      <div className="px-3 py-2.5 flex gap-2 border-t border-gray-200">
        <button
          onClick={() => onChange(DEFAULT_PREFERENCES)}
          className="flex-1 text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium"
        >
          Reset
        </button>
        {onClear && (
          <button
            onClick={onClear}
            className="flex-1 text-xs px-2 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded font-medium"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
