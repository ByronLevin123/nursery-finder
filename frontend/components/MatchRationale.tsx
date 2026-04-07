'use client'

import { useState } from 'react'
import type { MatchResult } from '@/lib/preferences'

interface Props {
  match: MatchResult
  defaultOpen?: boolean
}

const ICON: Record<string, string> = {
  pass: '✓',
  fail: '✗',
  unknown: '△',
}

const ICON_COLOR: Record<string, string> = {
  pass: 'text-green-600',
  fail: 'text-red-500',
  unknown: 'text-gray-400',
}

export default function MatchRationale({ match, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  if (match.excluded) {
    return (
      <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2">
        <p className="text-xs font-semibold text-red-800 mb-1">Excluded by your preferences</p>
        <ul className="text-xs text-red-700 space-y-0.5">
          {match.excludedReasons.map((r, i) => (
            <li key={i}>· {r}</li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-indigo-700 hover:text-indigo-900 hover:underline font-medium"
      >
        {open ? 'Hide' : 'Why this score?'}
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2 space-y-1">
          {match.rationale.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`font-bold ${ICON_COLOR[r.status]}`}>{ICON[r.status]}</span>
              <span className="text-gray-700 font-medium">{r.label}</span>
              {r.detail && <span className="text-gray-500">— {r.detail}</span>}
            </div>
          ))}
          <div className="border-t border-gray-200 mt-2 pt-1.5 grid grid-cols-5 gap-1 text-[10px] text-gray-500">
            <div>Q {match.componentScores.quality}</div>
            <div>P {match.componentScores.places}</div>
            <div>£ {match.componentScores.budget}</div>
            <div>📍 {match.componentScores.location}</div>
            <div>★ {match.componentScores.reviews}</div>
          </div>
        </div>
      )}
    </div>
  )
}
