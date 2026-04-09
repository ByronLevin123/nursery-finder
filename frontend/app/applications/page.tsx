'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/SessionProvider'
import VisitSurveyModal from '@/components/VisitSurveyModal'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

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
  nurseries: {
    name: string
    urn: string
    town: string | null
  } | null
}

interface Visit {
  id: string
  slot_id: string
  nursery_id: string
  status: string
  notes: string | null
  created_at: string
  visit_slots: {
    slot_date: string
    slot_time: string
    duration_min: number
  } | null
  nurseries: {
    name: string
    urn: string
    town: string | null
  } | null
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

const STATUS_ORDER = ['sent', 'opened', 'responded', 'visit_booked', 'place_offered', 'accepted']

export default function ApplicationsPage() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const [tab, setTab] = useState<'enquiries' | 'visits'>('enquiries')
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [surveyBookingId, setSurveyBookingId] = useState<string | null>(null)
  const [surveyNurseryName, setSurveyNurseryName] = useState('')

  useEffect(() => {
    if (sessionLoading) return
    if (!session) {
      router.push('/login?next=/applications')
      return
    }

    async function load() {
      try {
        const [enqRes, visitRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/enquiries/mine`, {
            headers: { Authorization: `Bearer ${session!.access_token}` },
          }),
          fetch(`${API_URL}/api/v1/visits/mine`, {
            headers: { Authorization: `Bearer ${session!.access_token}` },
          }),
        ])
        if (enqRes.ok) {
          const data = await enqRes.json()
          setEnquiries(data.data || [])
        }
        if (visitRes.ok) {
          const data = await visitRes.json()
          setVisits(data.data || [])
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [session, sessionLoading, router])

  async function cancelVisit(id: string) {
    if (!session) return
    try {
      const res = await fetch(`${API_URL}/api/v1/visits/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        setVisits((prev) => prev.map((v) => (v.id === id ? { ...v, status: 'cancelled' } : v)))
      }
    } catch { /* non-fatal */ }
  }

  function isPast(dateStr: string | null): boolean {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  if (sessionLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto mb-4" />
          <div className="h-4 bg-gray-200 rounded w-36 mx-auto" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Applications</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab('enquiries')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'enquiries' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Enquiries ({enquiries.length})
        </button>
        <button
          onClick={() => setTab('visits')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'visits' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Visits ({visits.length})
        </button>
      </div>

      {tab === 'enquiries' && (
        <>
          {enquiries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">You haven&apos;t sent any enquiries yet.</p>
              <Link
                href="/dashboard"
                className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Find nurseries
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {enquiries.map((enq) => {
                const statusIdx = STATUS_ORDER.indexOf(enq.status)
                return (
                  <div
                    key={enq.id}
                    className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
                  >
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div>
                        {enq.nurseries ? (
                          <Link
                            href={`/nursery/${enq.nurseries.urn}`}
                            className="font-semibold text-gray-900 hover:text-indigo-600"
                          >
                            {enq.nurseries.name}
                          </Link>
                        ) : (
                          <span className="font-semibold text-gray-900">Nursery</span>
                        )}
                        {enq.nurseries?.town && (
                          <p className="text-sm text-gray-500">{enq.nurseries.town}</p>
                        )}
                      </div>
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[enq.status] || STATUS_COLORS.sent}`}
                      >
                        {STATUS_LABELS[enq.status] || enq.status}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mb-3">
                      Sent {new Date(enq.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>

                    {/* Status timeline */}
                    <div className="flex items-center gap-1 mb-3">
                      {STATUS_ORDER.map((s, i) => (
                        <div key={s} className="flex items-center">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              i <= statusIdx ? 'bg-indigo-600' : 'bg-gray-200'
                            }`}
                          />
                          {i < STATUS_ORDER.length - 1 && (
                            <div
                              className={`w-6 h-0.5 ${
                                i < statusIdx ? 'bg-indigo-600' : 'bg-gray-200'
                              }`}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {enq.provider_notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-500 mb-1">Provider notes</p>
                        <p className="text-sm text-gray-700">{enq.provider_notes}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'visits' && (
        <>
          {visits.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No visits booked yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visits.map((v) => {
                const showSurvey =
                  v.status === 'confirmed' &&
                  v.visit_slots?.slot_date &&
                  isPast(v.visit_slots.slot_date)
                return (
                  <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div>
                        {v.nurseries ? (
                          <Link
                            href={`/nursery/${v.nurseries.urn}`}
                            className="font-semibold text-gray-900 hover:text-indigo-600"
                          >
                            {v.nurseries.name}
                          </Link>
                        ) : (
                          <span className="font-semibold text-gray-900">Nursery</span>
                        )}
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${
                        v.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200'
                        : v.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : v.status === 'cancelled' ? 'bg-gray-50 text-gray-500 border-gray-200'
                        : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }`}>
                        {v.status}
                      </span>
                    </div>

                    {v.visit_slots && (
                      <p className="text-sm text-gray-600 mb-2">
                        {new Date(v.visit_slots.slot_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {' '}at {v.visit_slots.slot_time} ({v.visit_slots.duration_min}min)
                      </p>
                    )}

                    <div className="flex gap-2 mt-3">
                      {v.status === 'confirmed' && !isPast(v.visit_slots?.slot_date ?? null) && (
                        <button
                          onClick={() => cancelVisit(v.id)}
                          className="text-xs px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100"
                        >
                          Cancel visit
                        </button>
                      )}
                      {showSurvey && (
                        <button
                          onClick={() => { setSurveyBookingId(v.id); setSurveyNurseryName(v.nurseries?.name || 'Nursery') }}
                          className="text-xs px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100"
                        >
                          How was your visit?
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {surveyBookingId && (
        <VisitSurveyModal
          bookingId={surveyBookingId}
          nurseryName={surveyNurseryName}
          onClose={() => setSurveyBookingId(null)}
          onSubmitted={() => {
            setSurveyBookingId(null)
            setVisits((prev) => prev.map((v) => v.id === surveyBookingId ? { ...v, status: 'completed' } : v))
          }}
        />
      )}
    </div>
  )
}
