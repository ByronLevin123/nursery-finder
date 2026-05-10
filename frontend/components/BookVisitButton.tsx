'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/components/SessionProvider'
import { useRouter } from 'next/navigation'
import { API_URL } from '@/lib/api'

interface Slot {
  id: string
  slot_date: string
  slot_time: string
  duration_min: number
  capacity: number
  booked: number
}

export default function BookVisitButton({ urn, nurseryId }: { urn: string; nurseryId: string }) {
  const { session, user } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function loadSlots() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/visits/slots/${urn}`)
      if (!res.ok) throw new Error('Failed to load slots')
      const data = await res.json()
      setSlots(data.data || [])
    } catch {
      setError('Could not load available slots')
    }
    setLoading(false)
  }

  function handleOpen() {
    if (!user) {
      router.push(`/login?next=/nursery/${urn}`)
      return
    }
    setOpen(true)
    loadSlots()
  }

  async function bookSlot(slotId: string) {
    if (!session) return
    setBooking(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/visits/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ slot_id: slotId, nursery_id: nurseryId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Booking failed')
        setBooking(false)
        return
      }
      setSuccess(true)
    } catch {
      setError('Booking failed')
    }
    setBooking(false)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
      >
        Book a visit
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Book a visit</h2>
              <button onClick={() => { setOpen(false); setSuccess(false); setError('') }}
                className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {success ? (
              <div className="text-center py-6">
                <p className="text-green-700 font-medium mb-2">Visit booked!</p>
                <p className="text-sm text-gray-600">Check your email for confirmation.</p>
                <button onClick={() => { setOpen(false); setSuccess(false) }}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Done</button>
              </div>
            ) : loading ? (
              <p className="text-center text-gray-500 py-6">Loading available slots...</p>
            ) : slots.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-2">This nursery hasn&apos;t set up online visit booking yet.</p>
                <p className="text-sm text-gray-400">Contact them directly to arrange a visit.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
                {slots.map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(slot.slot_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' '}at {slot.slot_time}
                      </p>
                      <p className="text-xs text-gray-500">
                        {slot.duration_min}min &middot; {slot.capacity - slot.booked} place{slot.capacity - slot.booked !== 1 ? 's' : ''} left
                      </p>
                    </div>
                    <button
                      onClick={() => bookSlot(slot.id)}
                      disabled={booking}
                      className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                      {booking ? '...' : 'Book'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
