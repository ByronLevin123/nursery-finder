'use client'

import { useState } from 'react'
import PriorityWizard from './PriorityWizard'

export default function PriorityWizardButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-indigo-300 bg-white text-indigo-700 font-semibold text-sm hover:border-indigo-500 hover:bg-indigo-50 transition shadow-sm"
      >
        ✨ Tell us what matters to you
      </button>
      <PriorityWizard open={open} onClose={() => setOpen(false)} />
    </>
  )
}
