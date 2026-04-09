'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { API_URL, Nursery } from '@/lib/api'

const STEPS = ['Select nursery', 'Pricing', 'Availability', 'Staff', 'Photos & description', 'Complete!']
const AGE_GROUPS = ['0-1', '1-2', '2-3', '3-4', '4-5']
const SESSION_TYPES = [
  { value: 'full_day', label: 'Full day' },
  { value: 'half_day_am', label: 'Half day (AM)' },
  { value: 'half_day_pm', label: 'Half day (PM)' },
  { value: 'flexible', label: 'Flexible' },
]

const DAYS: { key: string; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

interface DayHours { open: string; close: string; closed: boolean }
type HoursMap = Record<string, DayHours>

interface PricingRow {
  age_group: string
  session_type: string
  fee_per_month: string
  meals_included: boolean
  funded_hours_deducted: boolean
}

interface AvailabilityRow {
  age_group: string
  total_capacity: string
  current_enrolled: string
  waitlist_count: string
  next_available: string
  next_intake: string
}

interface StaffData {
  total_staff: string
  qualified_teachers: string
  level_3_plus: string
  avg_tenure_months: string
  ratio_under_2: string
  ratio_2_to_3: string
  ratio_3_plus: string
}

function defaultHours(): HoursMap {
  const out: HoursMap = {}
  for (const d of DAYS) {
    const weekend = d.key === 'saturday' || d.key === 'sunday'
    out[d.key] = { open: '07:30', close: '18:00', closed: weekend }
  }
  return out
}

function normaliseHours(input: Record<string, unknown> | null | undefined): HoursMap {
  const out = defaultHours()
  if (!input || typeof input !== 'object') return out
  const aliases: Record<string, string> = {
    mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday',
    fri: 'friday', sat: 'saturday', sun: 'sunday',
  }
  for (const [rawKey, val] of Object.entries(input)) {
    const key = aliases[rawKey.toLowerCase()] || rawKey.toLowerCase()
    if (!out[key]) continue
    if (val == null) continue
    if (typeof val === 'string') {
      const trimmed = val.trim()
      if (!trimmed || /closed/i.test(trimmed)) { out[key] = { open: '', close: '', closed: true }; continue }
      const m = trimmed.match(/^(\d{1,2}:\d{2})\s*[-\u2013]\s*(\d{1,2}:\d{2})$/)
      if (m) out[key] = { open: m[1], close: m[2], closed: false }
    } else if (typeof val === 'object' && val !== null) {
      const v = val as Record<string, unknown>
      out[key] = { open: typeof v.open === 'string' ? v.open : '', close: typeof v.close === 'string' ? v.close : '', closed: !!v.closed }
    }
  }
  return out
}

const MAX_PHOTOS = 6

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [selectedUrn, setSelectedUrn] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Pricing
  const [pricingRows, setPricingRows] = useState<PricingRow[]>(
    AGE_GROUPS.map((ag) => ({
      age_group: ag, session_type: 'full_day', fee_per_month: '', meals_included: false, funded_hours_deducted: false,
    }))
  )

  // Availability
  const [availRows, setAvailRows] = useState<AvailabilityRow[]>(
    AGE_GROUPS.map((ag) => ({
      age_group: ag, total_capacity: '', current_enrolled: '', waitlist_count: '', next_available: '', next_intake: '',
    }))
  )

  // Staff
  const [staff, setStaff] = useState<StaffData>({
    total_staff: '', qualified_teachers: '', level_3_plus: '', avg_tenure_months: '',
    ratio_under_2: '', ratio_2_to_3: '', ratio_3_plus: '',
  })

  // Photos + description + hours
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [hours, setHours] = useState<HoursMap>(defaultHours())

  // Completion tracking
  const [completed, setCompleted] = useState<Record<string, boolean>>({
    pricing: false, availability: false, staff: false, photos: false,
  })

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login?next=/provider/onboarding'); return }
      try {
        const res = await fetch(`${API_URL}/api/v1/provider/nurseries`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) throw new Error('failed')
        const j = await res.json()
        setNurseries(j.data || [])
      } catch { setError('Could not load your nurseries') }
      setLoading(false)
    }
    load()
  }, [router])

  async function getToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function savePricing() {
    setSaving(true); setError('')
    try {
      const token = await getToken()
      if (!token || !selectedUrn) return
      const rows = pricingRows.filter((r) => r.fee_per_month)
      if (rows.length === 0) { setStep(step + 1); setSaving(false); return }
      const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${selectedUrn}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(rows.map((r) => ({
          age_group: r.age_group, session_type: r.session_type,
          fee_per_month: parseFloat(r.fee_per_month) || null,
          meals_included: r.meals_included, funded_hours_deducted: r.funded_hours_deducted,
        }))),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Save failed'); setSaving(false); return }
      setCompleted((p) => ({ ...p, pricing: true }))
      setToast('Pricing saved'); setTimeout(() => setToast(''), 3000)
      setStep(step + 1)
    } catch { setError('Save failed') }
    setSaving(false)
  }

  async function saveAvailability() {
    setSaving(true); setError('')
    try {
      const token = await getToken()
      if (!token || !selectedUrn) return
      const rows = availRows.filter((r) => r.total_capacity)
      if (rows.length === 0) { setStep(step + 1); setSaving(false); return }
      const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${selectedUrn}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(rows.map((r) => ({
          age_group: r.age_group,
          total_capacity: parseInt(r.total_capacity) || null,
          current_enrolled: parseInt(r.current_enrolled) || 0,
          waitlist_count: parseInt(r.waitlist_count) || 0,
          next_available: r.next_available || null,
          next_intake: r.next_intake || null,
        }))),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Save failed'); setSaving(false); return }
      setCompleted((p) => ({ ...p, availability: true }))
      setToast('Availability saved'); setTimeout(() => setToast(''), 3000)
      setStep(step + 1)
    } catch { setError('Save failed') }
    setSaving(false)
  }

  async function saveStaff() {
    setSaving(true); setError('')
    try {
      const token = await getToken()
      if (!token || !selectedUrn) return
      const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${selectedUrn}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          total_staff: parseInt(staff.total_staff) || null,
          qualified_teachers: parseInt(staff.qualified_teachers) || null,
          level_3_plus: parseInt(staff.level_3_plus) || null,
          avg_tenure_months: parseInt(staff.avg_tenure_months) || null,
          ratio_under_2: staff.ratio_under_2 || null,
          ratio_2_to_3: staff.ratio_2_to_3 || null,
          ratio_3_plus: staff.ratio_3_plus || null,
        }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Save failed'); setSaving(false); return }
      setCompleted((p) => ({ ...p, staff: true }))
      setToast('Staff info saved'); setTimeout(() => setToast(''), 3000)
      setStep(step + 1)
    } catch { setError('Save failed') }
    setSaving(false)
  }

  async function savePhotosDescription() {
    setSaving(true); setError('')
    try {
      const token = await getToken()
      if (!token || !selectedUrn) return
      const cleanedPhotos = photos.map((p) => p.trim()).filter(Boolean).slice(0, MAX_PHOTOS)
      const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${selectedUrn}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description, photos: cleanedPhotos, opening_hours: hours }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Save failed'); setSaving(false); return }
      setCompleted((p) => ({ ...p, photos: true }))
      setToast('Profile saved'); setTimeout(() => setToast(''), 3000)
      setStep(step + 1)
    } catch { setError('Save failed') }
    setSaving(false)
  }

  function updatePricing(idx: number, patch: Partial<PricingRow>) {
    setPricingRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function updateAvail(idx: number, patch: Partial<AvailabilityRow>) {
    setAvailRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function updateDay(key: string, patch: Partial<DayHours>) {
    setHours((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>
  }

  const selectedNursery = nurseries.find((n) => n.urn === selectedUrn)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Nursery Onboarding</h1>
      {selectedNursery && <p className="text-sm text-gray-500 mb-4">Setting up: {selectedNursery.name}</p>}

      {/* Progress bar */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`flex-1 h-2 rounded-full ${i <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-600 mb-6">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{error}</div>}
      {toast && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 mb-4">{toast}</div>}

      {/* Step 0: Select nursery */}
      {step === 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Welcome! Select a nursery to set up.</h2>
          {nurseries.length === 0 ? (
            <p className="text-gray-500">No claimed nurseries. <Link href="/search" className="text-blue-600 hover:underline">Find and claim</Link> one first.</p>
          ) : (
            <div className="space-y-2">
              {nurseries.map((n) => (
                <button
                  key={n.urn}
                  onClick={() => { setSelectedUrn(n.urn); setDescription(n.description || ''); setPhotos(Array.isArray(n.photos) ? n.photos : []); setHours(normaliseHours(n.opening_hours)) }}
                  className={`w-full text-left p-4 border rounded-lg ${selectedUrn === n.urn ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <p className="font-semibold">{n.name}</p>
                  <p className="text-sm text-gray-500">{n.town}</p>
                </button>
              ))}
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => { if (selectedUrn) setStep(1) }}
              disabled={!selectedUrn}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Pricing */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Pricing by age group</h2>
          <div className="space-y-4">
            {pricingRows.map((row, idx) => (
              <div key={row.age_group} className="border border-gray-200 rounded-lg p-4">
                <p className="font-medium text-gray-700 mb-2">Age {row.age_group}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Monthly fee</label>
                    <input type="number" step="0.01" value={row.fee_per_month} onChange={(e) => updatePricing(idx, { fee_per_month: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Session type</label>
                    <select value={row.session_type} onChange={(e) => updatePricing(idx, { session_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {SESSION_TYPES.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input type="checkbox" checked={row.meals_included} onChange={(e) => updatePricing(idx, { meals_included: e.target.checked })} /> Meals included
                  </label>
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input type="checkbox" checked={row.funded_hours_deducted} onChange={(e) => updatePricing(idx, { funded_hours_deducted: e.target.checked })} /> Funded hours deducted
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(0)} className="px-6 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Back</button>
            <button onClick={savePricing} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save & Next'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Availability */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Availability by age group</h2>
          <div className="space-y-4">
            {availRows.map((row, idx) => (
              <div key={row.age_group} className="border border-gray-200 rounded-lg p-4">
                <p className="font-medium text-gray-700 mb-2">Age {row.age_group}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Total capacity</label>
                    <input type="number" value={row.total_capacity} onChange={(e) => updateAvail(idx, { total_capacity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Currently enrolled</label>
                    <input type="number" value={row.current_enrolled} onChange={(e) => updateAvail(idx, { current_enrolled: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Waitlist</label>
                    <input type="number" value={row.waitlist_count} onChange={(e) => updateAvail(idx, { waitlist_count: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="text-xs text-gray-500">Next available date</label>
                    <input type="date" value={row.next_available} onChange={(e) => updateAvail(idx, { next_available: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Next intake date</label>
                    <input type="date" value={row.next_intake} onChange={(e) => updateAvail(idx, { next_intake: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(1)} className="px-6 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Back</button>
            <button onClick={saveAvailability} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save & Next'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Staff */}
      {step === 3 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Staff information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">Total staff</label>
              <input type="number" value={staff.total_staff} onChange={(e) => setStaff((p) => ({ ...p, total_staff: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Qualified teachers</label>
              <input type="number" value={staff.qualified_teachers} onChange={(e) => setStaff((p) => ({ ...p, qualified_teachers: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Level 3+</label>
              <input type="number" value={staff.level_3_plus} onChange={(e) => setStaff((p) => ({ ...p, level_3_plus: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Avg tenure (months)</label>
              <input type="number" value={staff.avg_tenure_months} onChange={(e) => setStaff((p) => ({ ...p, avg_tenure_months: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <h3 className="font-medium text-gray-700 mt-6 mb-2">Staff-to-child ratios</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500">Under 2</label>
              <input type="text" placeholder="1:3" value={staff.ratio_under_2} onChange={(e) => setStaff((p) => ({ ...p, ratio_under_2: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">2-3 years</label>
              <input type="text" placeholder="1:4" value={staff.ratio_2_to_3} onChange={(e) => setStaff((p) => ({ ...p, ratio_2_to_3: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">3+ years</label>
              <input type="text" placeholder="1:8" value={staff.ratio_3_plus} onChange={(e) => setStaff((p) => ({ ...p, ratio_3_plus: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(2)} className="px-6 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Back</button>
            <button onClick={saveStaff} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save & Next'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Photos & description */}
      {step === 4 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Photos, description & hours</h2>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg" placeholder="Tell parents about your nursery..." />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Photos ({photos.length}/{MAX_PHOTOS})</label>
              <button type="button" onClick={() => setPhotos((p) => p.length >= MAX_PHOTOS ? p : [...p, ''])}
                disabled={photos.length >= MAX_PHOTOS} className="text-xs text-blue-600 hover:underline disabled:opacity-40">
                + Add photo URL
              </button>
            </div>
            {photos.map((url, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <input type="url" value={url} onChange={(e) => setPhotos((p) => p.map((v, i) => i === idx ? e.target.value : v))}
                  placeholder="https://..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <button type="button" onClick={() => setPhotos((p) => p.filter((_, i) => i !== idx))}
                  className="text-xs text-red-600 hover:underline">Remove</button>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">Opening hours</label>
            <div className="space-y-2">
              {DAYS.map((d) => {
                const row = hours[d.key]
                return (
                  <div key={d.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                    <span className="w-24 text-sm font-medium text-gray-700">{d.label}</span>
                    <label className="flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" checked={row.closed} onChange={(e) => updateDay(d.key, { closed: e.target.checked })} /> Closed
                    </label>
                    <input type="time" value={row.open} disabled={row.closed} onChange={(e) => updateDay(d.key, { open: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100" />
                    <span className="text-xs text-gray-400">to</span>
                    <input type="time" value={row.close} disabled={row.closed} onChange={(e) => updateDay(d.key, { close: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100" />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(3)} className="px-6 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Back</button>
            <button onClick={savePhotosDescription} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save & Complete'}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 5 && (
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-green-700 mb-4">Setup complete!</h2>
          <p className="text-gray-600 mb-6">Your nursery profile has been updated.</p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-medium mb-2">What was filled:</h3>
            <ul className="space-y-1 text-sm">
              <li className={completed.pricing ? 'text-green-700' : 'text-gray-400'}>
                {completed.pricing ? 'Pricing' : 'Pricing (skipped)'}
              </li>
              <li className={completed.availability ? 'text-green-700' : 'text-gray-400'}>
                {completed.availability ? 'Availability' : 'Availability (skipped)'}
              </li>
              <li className={completed.staff ? 'text-green-700' : 'text-gray-400'}>
                {completed.staff ? 'Staff info' : 'Staff info (skipped)'}
              </li>
              <li className={completed.photos ? 'text-green-700' : 'text-gray-400'}>
                {completed.photos ? 'Photos & description' : 'Photos & description (skipped)'}
              </li>
            </ul>
          </div>

          <div className="flex justify-center gap-4">
            {selectedUrn && (
              <Link href={`/nursery/${selectedUrn}`} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                View your profile
              </Link>
            )}
            <Link href="/provider" className="px-6 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Go to dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
