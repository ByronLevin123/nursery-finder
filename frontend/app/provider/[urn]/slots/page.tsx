'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { API_URL } from '@/lib/api'

interface Slot {
  id: string
  slot_date: string
  slot_time: string
  duration_min: number
  capacity: number
  booked: number
}

export default function ProviderSlotsPage({ params }: { params: { urn: string } }) {
  const router = useRouter()
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Add slots form
  const [addDate, setAddDate] = useState('')
  const [addTime, setAddTime] = useState('10:00')
  const [addDuration, setAddDuration] = useState('30')
  const [addCapacity, setAddCapacity] = useState('1')
  const [recurring, setRecurring] = useState(false)
  const [recurWeeks, setRecurWeeks] = useState('4')
  const [adding, setAdding] = useState(false)

  async function getToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function load() {
    const token = await getToken()
    if (!token) { router.push(`/login?next=/provider/${params.urn}/slots`); return }
    try {
      const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${params.urn}/slots`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load slots')
      const data = await res.json()
      setSlots(data.data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [params.urn, router])

  async function addSlots() {
    if (!addDate || !addTime) return
    setAdding(true); setError('')
    try {
      const token = await getToken()
      if (!token) return

      const dates: string[] = [addDate]
      if (recurring) {
        const weeks = parseInt(recurWeeks) || 4
        const base = new Date(addDate)
        for (let w = 1; w < weeks; w++) {
          const d = new Date(base)
          d.setDate(d.getDate() + w * 7)
          dates.push(d.toISOString().split('T')[0])
        }
      }

      const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${params.urn}/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dates,
          time: addTime,
          duration_min: parseInt(addDuration) || 30,
          capacity: parseInt(addCapacity) || 1,
        }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Failed to add slots'); setAdding(false); return }
      setToast(`${dates.length} slot(s) created`); setTimeout(() => setToast(''), 3000)
      setAddDate(''); setRecurring(false)
      await load()
    } catch { setError('Failed to add slots') }
    setAdding(false)
  }

  async function deleteSlot(id: string) {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${params.urn}/slots/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { setError('Failed to delete slot'); return }
      setSlots((prev) => prev.filter((s) => s.id !== id))
      setToast('Slot deleted'); setTimeout(() => setToast(''), 3000)
    } catch { setError('Delete failed') }
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Visit Slots</h1>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{error}</div>}
      {toast && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 mb-4">{toast}</div>}

      {/* Add slots form */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h2 className="font-medium text-gray-700 mb-3">Add visit slots</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="text-xs text-gray-500">Date</label>
            <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Time</label>
            <input type="time" value={addTime} onChange={(e) => setAddTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Duration (min)</label>
            <input type="number" value={addDuration} onChange={(e) => setAddDuration(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Capacity</label>
            <input type="number" value={addCapacity} onChange={(e) => setAddCapacity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-4 mb-3">
          <label className="flex items-center gap-1 text-sm text-gray-600">
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
            Recurring weekly
          </label>
          {recurring && (
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-600">for</span>
              <input type="number" value={recurWeeks} onChange={(e) => setRecurWeeks(e.target.value)}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm" min="1" max="52" />
              <span className="text-sm text-gray-600">weeks</span>
            </div>
          )}
        </div>
        <button onClick={addSlots} disabled={adding || !addDate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {adding ? 'Adding...' : 'Add slots'}
        </button>
      </div>

      {/* Slots list */}
      {slots.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No slots created yet.</p>
      ) : (
        <div className="space-y-2">
          {slots.map((slot) => (
            <div key={slot.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">
                  {new Date(slot.slot_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' '}at {slot.slot_time}
                </p>
                <p className="text-xs text-gray-500">
                  {slot.duration_min}min &middot; {slot.booked}/{slot.capacity} booked
                </p>
              </div>
              <button
                onClick={() => deleteSlot(slot.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
