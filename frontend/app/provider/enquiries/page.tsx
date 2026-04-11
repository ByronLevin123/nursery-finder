'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/SessionProvider'
import MessageThread from '@/components/MessageThread'
import { API_URL } from '@/lib/api'

interface Enquiry {
  id: string
  nursery_id: string
  child_name: string | null
  child_dob: string | null
  preferred_start: string | null
  session_preference: string | null
  message: string | null
  status: string
  provider_notes: string | null
  sent_at: string
  responded_at: string | null
  nursery?: { id: string; urn: string; name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  opened: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  responded: 'bg-green-50 text-green-700 border-green-200',
  visit_booked: 'bg-purple-50 text-purple-700 border-purple-200',
  place_offered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  accepted: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  declined: 'bg-gray-50 text-gray-500 border-gray-200',
}

const STATUS_LABELS: Record<string, string> = {
  sent: 'Sent',
  opened: 'Opened',
  responded: 'Responded',
  visit_booked: 'Visit booked',
  place_offered: 'Place offered',
  accepted: 'Accepted',
  declined: 'Declined',
}

export default function ProviderEnquiriesPage() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (sessionLoading) return
    if (!session) { router.push('/login?next=/provider/enquiries'); return }

    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/v1/provider/enquiries`, {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        })
        if (!res.ok) throw new Error('Failed to load enquiries')
        const data = await res.json()
        setEnquiries(data.data || [])
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session, sessionLoading, router])

  async function updateStatus(id: string, status: string) {
    if (!session) return
    setUpdatingId(id)
    try {
      const res = await fetch(`${API_URL}/api/v1/provider/enquiries/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Update failed')
        setUpdatingId(null)
        return
      }
      const updated = await res.json()
      setEnquiries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)))
    } catch {
      setError('Update failed')
    }
    setUpdatingId(null)
  }

  function childAge(dob: string | null): string | null {
    if (!dob) return null
    const d = new Date(dob)
    const now = new Date()
    const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
    if (months < 0) return null
    return `${months} months`
  }

  if (sessionLoading || loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Provider Enquiry Inbox</h1>
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{error}</div>}

      {enquiries.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No enquiries yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {enquiries.map((enq) => (
            <div key={enq.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start gap-4 mb-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {enq.nursery?.name || 'Nursery'}
                  </p>
                  {enq.child_name && (
                    <p className="text-sm text-gray-600">
                      Child: {enq.child_name}
                      {enq.child_dob && <span className="text-gray-400"> ({childAge(enq.child_dob)})</span>}
                    </p>
                  )}
                </div>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[enq.status] || STATUS_COLORS.sent}`}>
                  {STATUS_LABELS[enq.status] || enq.status}
                </span>
              </div>

              {enq.preferred_start && (
                <p className="text-sm text-gray-600 mb-1">
                  Preferred start: {new Date(enq.preferred_start).toLocaleDateString('en-GB')}
                </p>
              )}
              {enq.session_preference && (
                <p className="text-sm text-gray-600 mb-1">Session: {enq.session_preference}</p>
              )}
              {enq.message && (
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-3">{enq.message}</p>
              )}
              <p className="text-xs text-gray-400 mb-3">
                Received {new Date(enq.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>

              {enq.provider_notes && (
                <div className="p-3 bg-blue-50 rounded-lg mb-3">
                  <p className="text-xs font-medium text-blue-600 mb-1">Your notes</p>
                  <p className="text-sm text-blue-800">{enq.provider_notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {(enq.status === 'sent' || enq.status === 'opened') && (
                  <button
                    onClick={() => updateStatus(enq.id, 'responded')}
                    disabled={updatingId === enq.id}
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Mark as responded
                  </button>
                )}
                {enq.status !== 'visit_booked' && enq.status !== 'declined' && enq.status !== 'accepted' && (
                  <button
                    onClick={() => updateStatus(enq.id, 'visit_booked')}
                    disabled={updatingId === enq.id}
                    className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    Book a visit
                  </button>
                )}
                {enq.status !== 'declined' && enq.status !== 'accepted' && (
                  <button
                    onClick={() => updateStatus(enq.id, 'declined')}
                    disabled={updatingId === enq.id}
                    className="text-xs px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                  >
                    Decline
                  </button>
                )}
              </div>

              {/* Messages section */}
              <div className="mt-3">
                <button
                  onClick={() =>
                    setExpandedMessages((prev) => ({
                      ...prev,
                      [enq.id]: !prev[enq.id],
                    }))
                  }
                  className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-100 flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {expandedMessages[enq.id] ? 'Hide messages' : 'Messages'}
                </button>
                {expandedMessages[enq.id] && (
                  <div className="mt-2">
                    <MessageThread enquiryId={enq.id} currentUserRole="provider" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
