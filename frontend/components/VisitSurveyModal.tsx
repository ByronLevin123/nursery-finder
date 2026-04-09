'use client'

import { useState } from 'react'
import { useSession } from '@/components/SessionProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface VisitSurveyModalProps {
  bookingId: string
  nurseryName: string
  onClose: () => void
  onSubmitted: () => void
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-8 h-8 rounded-full text-sm font-medium border ${
            n <= value
              ? 'bg-yellow-400 border-yellow-500 text-white'
              : 'bg-gray-100 border-gray-200 text-gray-400'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export default function VisitSurveyModal({ bookingId, nurseryName, onClose, onSubmitted }: VisitSurveyModalProps) {
  const { session } = useSession()
  const [overall, setOverall] = useState(0)
  const [staffScore, setStaffScore] = useState(0)
  const [facilities, setFacilities] = useState(0)
  const [wouldApply, setWouldApply] = useState<boolean | null>(null)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!session || overall === 0) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/visits/${bookingId}/survey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          overall_impression: overall,
          staff_friendliness: staffScore || null,
          facilities_quality: facilities || null,
          would_apply: wouldApply,
          feedback: feedback || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Submission failed')
        setSubmitting(false)
        return
      }
      onSubmitted()
    } catch {
      setError('Submission failed')
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">How was your visit to {nurseryName}?</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Overall impression *</label>
            <StarRating value={overall} onChange={setOverall} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Staff friendliness</label>
            <StarRating value={staffScore} onChange={setStaffScore} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Facilities quality</label>
            <StarRating value={facilities} onChange={setFacilities} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Would you apply?</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setWouldApply(true)}
                className={`px-4 py-2 rounded-lg text-sm border ${wouldApply === true ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                Yes
              </button>
              <button type="button" onClick={() => setWouldApply(false)}
                className={`px-4 py-2 rounded-lg text-sm border ${wouldApply === false ? 'bg-red-50 border-red-300 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                No
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Any feedback? (optional)</label>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="What stood out..." />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || overall === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit survey'}
          </button>
        </div>
      </div>
    </div>
  )
}
