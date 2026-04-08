'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { API_URL } from '@/lib/api'

interface Props {
  urn: string
  nurseryName: string
  alreadyClaimed: boolean
  claimedByCurrentUser: boolean
}

const ROLES = ['Owner', 'Manager', 'Marketing', 'Other']

type MyClaim = { urn: string; status: 'pending' | 'approved' | 'rejected' }

export default function ClaimNurseryButton({
  urn,
  nurseryName,
  alreadyClaimed,
  claimedByCurrentUser,
}: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [myClaim, setMyClaim] = useState<MyClaim | null>(null)
  const [checkedClaims, setCheckedClaims] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')
  const [evidence, setEvidence] = useState('')

  // Check whether this user already has a claim for this nursery.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) {
          if (!cancelled) setCheckedClaims(true)
          return
        }
        const res = await fetch(`${API_URL}/api/v1/claims/mine`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const j = await res.json()
          const mine = (j.data || []).find((c: MyClaim) => c.urn === urn) || null
          if (!cancelled) setMyClaim(mine)
        }
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setCheckedClaims(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [urn])

  // Pill: already managed by this user
  if (claimedByCurrentUser || myClaim?.status === 'approved') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-center">
        <span className="inline-block text-xs px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-medium">
          You manage this nursery
        </span>
      </div>
    )
  }

  // Pill: claim pending
  if (myClaim?.status === 'pending') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-center">
        <span className="inline-block text-xs px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium">
          Claim pending review
        </span>
      </div>
    )
  }

  // If claimed by someone else, don't show CTA
  if (alreadyClaimed) return null

  async function handleButtonClick() {
    setError('')
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push(`/login?next=/nursery/${urn}?claim=1`)
      return
    }
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?next=/nursery/${urn}?claim=1`)
        return
      }
      const claimerName =
        (session.user.user_metadata && (session.user.user_metadata as any).display_name) ||
        session.user.email ||
        'Provider'
      const res = await fetch(`${API_URL}/api/v1/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          urn,
          claimer_name: claimerName,
          claimer_email: session.user.email,
          claimer_role: role || undefined,
          claimer_phone: phone || undefined,
          evidence_notes: evidence || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Failed to submit claim')
      } else {
        const j = await res.json()
        setMyClaim({ urn, status: j.status || 'pending' })
        setModalOpen(false)
        setToast('Claim submitted — we will review within 2 working days.')
        setTimeout(() => setToast(''), 4500)
      }
    } catch {
      setError('Failed to submit claim')
    }
    setSubmitting(false)
  }

  if (!checkedClaims) {
    // Avoid flashing the button while we check existing claims
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-center text-xs text-gray-400">
        Loading…
      </div>
    )
  }

  return (
    <>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-center">
        <p className="text-sm text-gray-600 mb-2">Is this your nursery?</p>
        <button
          type="button"
          onClick={handleButtonClick}
          className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          Claim this nursery
        </button>
        {toast && <p className="mt-3 text-sm text-green-700">{toast}</p>}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-1">Claim {nurseryName}</h2>
            <p className="text-xs text-gray-500 mb-4">
              Tell us how you're connected. We review claims within 2 working days.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Your role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select…</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Phone (optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Evidence notes</label>
                <textarea
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  rows={3}
                  placeholder="e.g. work email, role, link to staff page"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !role}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Submit claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
