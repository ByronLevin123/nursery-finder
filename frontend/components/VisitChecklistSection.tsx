'use client'

import { useState } from 'react'
import Link from 'next/link'
import VisitChecklist from './VisitChecklist'

interface VisitChecklistSectionProps {
  nurseryName: string
  nurseryUrn: string
}

export default function VisitChecklistSection({ nurseryName, nurseryUrn }: VisitChecklistSectionProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 border border-indigo-200 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {open ? 'Hide' : 'Show'} Visit Checklist
        </button>
        <Link
          href="/guides/visit-checklist"
          className="text-xs text-gray-500 hover:text-indigo-600 underline"
        >
          Open full guide
        </Link>
      </div>

      {open && (
        <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-white">
          <VisitChecklist nurseryName={nurseryName} nurseryUrn={nurseryUrn} />
        </div>
      )}
    </div>
  )
}
