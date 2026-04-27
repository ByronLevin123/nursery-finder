'use client'

import { useCallback, useState } from 'react'
import { useSession } from '@/components/SessionProvider'
import Link from 'next/link'
import { API_URL } from '@/lib/api'
import TurnstileWidget from '@/components/TurnstileWidget'

interface NurseryItem {
  id: string
  urn: string
  name: string
  town: string | null
}

interface Props {
  nurseries: NurseryItem[]
  onClose: () => void
  childName?: string
  childDob?: string
}

export default function EnquiryModal({ nurseries, onClose, childName, childDob }: Props) {
  const { session, user } = useSession()
  const [selected, setSelected] = useState<string[]>(nurseries.map((n) => n.id))
  const [formChildName, setFormChildName] = useState(childName || '')
  const [formChildDob, setFormChildDob] = useState(childDob || '')
  const [preferredStart, setPreferredStart] = useState('')
  const [sessionPref, setSessionPref] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [queuedMessage, setQueuedMessage] = useState('')
  const [error, setError] = useState('')
  // Turnstile token. Empty string means either: (a) no Turnstile site key
  // configured (graceful degradation — backend also no-ops) or (b) the
  // user hasn't completed the challenge yet. The widget calls onToken('')
  // in case (a) on mount, so we don't need to gate submission separately.
  const [turnstileToken, setTurnstileToken] = useState<string>(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? '' : 'unconfigured'
  )

  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token || (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? '' : 'unconfigured'))
  }, [])

  function toggleNursery(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit() {
    if (!session) return
    if (selected.length === 0) {
      setError('Select at least one nursery')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/enquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nursery_ids: selected,
          child_name: formChildName || null,
          child_dob: formChildDob || null,
          preferred_start: preferredStart || null,
          session_preference: sessionPref || null,
          message: message || null,
          turnstile_token: turnstileToken === 'unconfigured' ? undefined : turnstileToken,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to send enquiries')
      }
      const result = await res.json()
      if (result.message) setQueuedMessage(result.message)
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Sign in to enquire</h2>
          <p className="text-sm text-gray-600 mb-4">You need to be signed in to send enquiries.</p>
          <Link
            href="/login?next=/compare"
            className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl p-6 max-w-md w-full text-center" onClick={(e) => e.stopPropagation()}>
          <div className="text-4xl mb-3">&#10003;</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Enquiries sent to {selected.length} {selected.length === 1 ? 'nursery' : 'nurseries'}!
          </h2>
          {queuedMessage && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              {queuedMessage}
            </p>
          )}
          <p className="text-sm text-gray-600 mb-4">Track responses at your applications page.</p>
          <div className="flex gap-2 justify-center">
            <Link
              href="/applications"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
            >
              View applications
            </Link>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900">Send enquiry</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {/* Nursery selection */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Select nurseries</p>
          <div className="space-y-2">
            {nurseries.map((n) => (
              <label
                key={n.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                  selected.includes(n.id)
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(n.id)}
                  onChange={() => toggleNursery(n.id)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{n.name}</p>
                  {n.town && <p className="text-xs text-gray-500">{n.town}</p>}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Child&apos;s name</label>
            <input
              type="text"
              value={formChildName}
              onChange={(e) => setFormChildName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of birth</label>
            <input
              type="date"
              value={formChildDob}
              onChange={(e) => setFormChildDob(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred start date</label>
            <input
              type="date"
              value={preferredStart}
              onChange={(e) => setPreferredStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session preference</label>
            <select
              value={sessionPref}
              onChange={(e) => setSessionPref(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">No preference</option>
              <option value="full_day">Full day</option>
              <option value="half_day_am">Half day (AM)</option>
              <option value="half_day_pm">Half day (PM)</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
              placeholder="Any additional details..."
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {/* Turnstile renders only when site key is configured. */}
        <TurnstileWidget onToken={handleTurnstileToken} />

        <button
          onClick={handleSubmit}
          disabled={submitting || selected.length === 0 || !turnstileToken}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting
            ? 'Sending...'
            : `Send to ${selected.length} ${selected.length === 1 ? 'nursery' : 'nurseries'}`}
        </button>
      </div>
    </div>
  )
}
