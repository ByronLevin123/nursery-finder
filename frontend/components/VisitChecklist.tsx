'use client'

import { useState, useEffect, useCallback } from 'react'

interface VisitChecklistProps {
  nurseryName?: string
  nurseryUrn?: string
}

interface ChecklistSection {
  title: string
  items: string[]
}

const SECTIONS: ChecklistSection[] = [
  {
    title: 'Safety & Security',
    items: [
      'Secure entry and exit — door codes, buzzer, or sign-in system',
      'CCTV in use and clearly signposted',
      'Clear accident and incident procedures explained',
      'Regular fire drills carried out and logged',
      'All staff have up-to-date DBS checks',
    ],
  },
  {
    title: 'Staff & Ratios',
    items: [
      'Staff qualifications — ask about Level 3 and above',
      'Adult-to-child ratios meet or exceed statutory minimums',
      'Key worker system in place for each child',
      'Low staff turnover — ask how long most staff have been there',
    ],
  },
  {
    title: 'Learning & Development',
    items: [
      'EYFS curriculum followed with clear planning',
      'Regular outdoor play opportunities',
      'Structured activities alongside free play',
      'Progress tracking — how are milestones recorded and shared?',
    ],
  },
  {
    title: 'Facilities',
    items: [
      'Clean, child-appropriate toilets and handwashing',
      'Dedicated sleep/rest area for younger children',
      'Safe, well-maintained outdoor space',
      'Separate meal preparation area',
      'Sensory play resources available',
    ],
  },
  {
    title: 'Food & Nutrition',
    items: [
      'Varied, balanced menu available to view',
      'Clear allergy and dietary requirement handling',
      'Structured, sociable mealtimes',
      'Fresh cooking on site (not just reheated meals)',
    ],
  },
  {
    title: 'Communication',
    items: [
      'Daily reports or updates provided (written or via app)',
      'Parent app or online portal for photos and updates',
      'Regular parent evenings or progress meetings',
      'Clear settling-in policy explained',
    ],
  },
  {
    title: 'Practicalities',
    items: [
      'Opening hours suit your schedule',
      'Fees clearly explained — ask for a full fee schedule',
      'Funded hours accepted (15h or 30h)',
      'Sibling discounts or multi-day discounts available',
      'Notice period and contract terms explained',
    ],
  },
]

function storageKey(urn?: string) {
  return urn ? `visit-checklist-${urn}` : 'visit-checklist-generic'
}

function notesKey(urn?: string) {
  return urn ? `visit-checklist-notes-${urn}` : 'visit-checklist-notes-generic'
}

export default function VisitChecklist({ nurseryName, nurseryUrn }: VisitChecklistProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(nurseryUrn))
      if (saved) setChecked(JSON.parse(saved))
      const savedNotes = localStorage.getItem(notesKey(nurseryUrn))
      if (savedNotes) setNotes(savedNotes)
    } catch {
      // localStorage unavailable
    }
    setLoaded(true)
  }, [nurseryUrn])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(storageKey(nurseryUrn), JSON.stringify(checked))
    } catch {
      // localStorage unavailable
    }
  }, [checked, nurseryUrn, loaded])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(notesKey(nurseryUrn), notes)
    } catch {
      // localStorage unavailable
    }
  }, [notes, nurseryUrn, loaded])

  const toggle = useCallback((key: string) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const totalItems = SECTIONS.reduce((sum, s) => sum + s.items.length, 0)
  const checkedCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="print:block">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {nurseryName ? `Visit Checklist: ${nurseryName}` : 'Nursery Visit Checklist'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {checkedCount} of {totalItems} items checked
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="print:hidden self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print checklist
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-6 print:hidden">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${totalItems ? (checkedCount / totalItems) * 100 : 0}%` }}
        />
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title} className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">{section.title}</h3>
            <ul className="space-y-2">
              {section.items.map((item) => {
                const key = `${section.title}::${item}`
                const isChecked = !!checked[key]
                return (
                  <li key={key}>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(key)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 print:border-gray-400"
                      />
                      <span
                        className={`text-sm transition-colors ${
                          isChecked ? 'text-gray-400 line-through' : 'text-gray-700 group-hover:text-gray-900'
                        }`}
                      >
                        {item}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="mt-6">
        <label htmlFor="visit-notes" className="block text-sm font-semibold text-gray-900 mb-2">
          Your Notes
        </label>
        <textarea
          id="visit-notes"
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Write any additional observations, questions, or impressions from your visit..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 print:border-gray-400"
        />
      </div>
    </div>
  )
}
