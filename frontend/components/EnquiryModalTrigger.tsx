'use client'

import { useState } from 'react'
import EnquiryModal from './EnquiryModal'

interface Props {
  urn: string
  nurseryName: string
  nurseryId: string
  town?: string | null
}

export default function EnquiryModalTrigger({ urn, nurseryName, nurseryId, town }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Send Enquiry
      </button>
      {open && (
        <EnquiryModal
          nurseries={[{ id: nurseryId, urn, name: nurseryName, town: town ?? null }]}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
