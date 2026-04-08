'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { API_URL } from '@/lib/api'

interface DayHours {
  open: string
  close: string
  closed: boolean
}

type HoursMap = Record<string, DayHours>

interface ProviderNursery {
  urn: string
  name: string
  description?: string | null
  opening_hours?: Record<string, any> | null
  photos?: string[] | null
  website_url?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  provider_updated_at?: string | null
}

const DAYS: { key: string; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

const MAX_PHOTOS = 6

function defaultHours(): HoursMap {
  const out: HoursMap = {}
  for (const d of DAYS) {
    const weekend = d.key === 'saturday' || d.key === 'sunday'
    out[d.key] = { open: '07:30', close: '18:00', closed: weekend }
  }
  return out
}

// Accept legacy shapes: { mon: "08:00-18:00" } or { monday: {open, close, closed} }
function normaliseHours(input: Record<string, any> | null | undefined): HoursMap {
  const out = defaultHours()
  if (!input || typeof input !== 'object') return out
  const aliases: Record<string, string> = {
    mon: 'monday',
    tue: 'tuesday',
    wed: 'wednesday',
    thu: 'thursday',
    fri: 'friday',
    sat: 'saturday',
    sun: 'sunday',
  }
  for (const [rawKey, val] of Object.entries(input)) {
    const key = aliases[rawKey.toLowerCase()] || rawKey.toLowerCase()
    if (!out[key]) continue
    if (val == null) continue
    if (typeof val === 'string') {
      const trimmed = val.trim()
      if (!trimmed || /closed/i.test(trimmed)) {
        out[key] = { open: '', close: '', closed: true }
        continue
      }
      const m = trimmed.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/)
      if (m) out[key] = { open: m[1], close: m[2], closed: false }
    } else if (typeof val === 'object') {
      out[key] = {
        open: typeof val.open === 'string' ? val.open : '',
        close: typeof val.close === 'string' ? val.close : '',
        closed: !!val.closed,
      }
    }
  }
  return out
}

export default function ProviderEditPage({ params }: { params: { urn: string } }) {
  const router = useRouter()
  const [nursery, setNursery] = useState<ProviderNursery | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [description, setDescription] = useState('')
  const [hours, setHours] = useState<HoursMap>(defaultHours())
  const [photos, setPhotos] = useState<string[]>([])
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?next=/provider/${params.urn}/edit`)
        return
      }
      try {
        const res = await fetch(`${API_URL}/api/v1/provider/nurseries`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) throw new Error('failed')
        const j = await res.json()
        const found = (j.data || []).find((n: ProviderNursery) => n.urn === params.urn)
        if (!found) {
          setError('You do not own this nursery (or it does not exist).')
          setLoading(false)
          return
        }
        setNursery(found)
        setDescription(found.description || '')
        setHours(normaliseHours(found.opening_hours))
        setPhotos(Array.isArray(found.photos) ? found.photos.slice(0, MAX_PHOTOS) : [])
        setWebsiteUrl(found.website_url || '')
        setContactEmail(found.contact_email || '')
        setContactPhone(found.contact_phone || '')
      } catch {
        setError('Failed to load')
      }
      setLoading(false)
    }
    load()
  }, [params.urn, router])

  function updateDay(key: string, patch: Partial<DayHours>) {
    setHours((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  function updatePhoto(idx: number, value: string) {
    setPhotos((prev) => prev.map((p, i) => (i === idx ? value : p)))
  }

  function addPhoto() {
    setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, '']))
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setToast('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?next=/provider/${params.urn}/edit`)
        return
      }
      const cleanedPhotos = photos.map((p) => p.trim()).filter(Boolean).slice(0, MAX_PHOTOS)
      const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${params.urn}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          description,
          opening_hours: hours,
          photos: cleanedPhotos,
          website_url: websiteUrl,
          contact_email: contactEmail,
          contact_phone: contactPhone,
        }),
      })
      if (res.status === 403) {
        setError('You do not own this nursery')
      } else if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Save failed')
      } else {
        const j = await res.json()
        setNursery(j)
        setToast('Saved')
        setTimeout(() => setToast(''), 3500)
      }
    } catch {
      setError('Save failed')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>
  }
  if (!nursery) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-red-500">{error}</div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Edit {nursery.name}</h1>
      {nursery.provider_updated_at && (
        <p className="text-xs text-gray-500 mb-6">
          Last updated {new Date(nursery.provider_updated_at).toLocaleString('en-GB')}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="text-sm font-medium text-gray-700">About this nursery</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Opening hours</label>
          <div className="space-y-2">
            {DAYS.map((d) => {
              const row = hours[d.key]
              return (
                <div
                  key={d.key}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
                >
                  <span className="w-24 text-sm font-medium text-gray-700">{d.label}</span>
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={row.closed}
                      onChange={(e) => updateDay(d.key, { closed: e.target.checked })}
                    />
                    Closed
                  </label>
                  <input
                    type="time"
                    value={row.open}
                    disabled={row.closed}
                    onChange={(e) => updateDay(d.key, { open: e.target.value })}
                    className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    type="time"
                    value={row.close}
                    disabled={row.closed}
                    onChange={(e) => updateDay(d.key, { close: e.target.value })}
                    className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Photos ({photos.length}/{MAX_PHOTOS})
            </label>
            <button
              type="button"
              onClick={addPhoto}
              disabled={photos.length >= MAX_PHOTOS}
              className="text-xs text-blue-600 hover:underline disabled:opacity-40"
            >
              + Add photo URL
            </button>
          </div>
          {photos.length === 0 && (
            <p className="text-xs text-gray-500">No photos yet. Add up to {MAX_PHOTOS} image URLs.</p>
          )}
          <div className="space-y-2">
            {photos.map((url, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`Preview ${idx + 1}`}
                    className="w-16 h-16 object-cover rounded border border-gray-200"
                    onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')}
                  />
                ) : (
                  <div className="w-16 h-16 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                    preview
                  </div>
                )}
                <input
                  type="url"
                  value={url}
                  onChange={(e) => updatePhoto(idx, e.target.value)}
                  placeholder="https://…"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Website</label>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Contact email</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Contact phone</label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
        {toast && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            {toast}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
