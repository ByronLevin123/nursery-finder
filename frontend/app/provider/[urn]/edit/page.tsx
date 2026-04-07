'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { API_URL } from '@/lib/api'

interface ProviderNursery {
  urn: string
  name: string
  description?: string | null
  opening_hours?: Record<string, string> | null
  photos?: string[] | null
  website_url?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  provider_updated_at?: string | null
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export default function ProviderEditPage({ params }: { params: { urn: string } }) {
  const router = useRouter()
  const [nursery, setNursery] = useState<ProviderNursery | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [description, setDescription] = useState('')
  const [hours, setHours] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState('')
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
        setHours(found.opening_hours || {})
        setPhotos((found.photos || []).join('\n'))
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
      const photoArr = photos
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${params.urn}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          description,
          opening_hours: hours,
          photos: photoArr,
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

      <form onSubmit={handleSubmit} className="space-y-5">
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
          <label className="text-sm font-medium text-gray-700">Opening hours</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {DAYS.map((d) => (
              <div key={d} className="flex items-center gap-2">
                <span className="w-12 text-sm text-gray-500 uppercase">{d}</span>
                <input
                  type="text"
                  placeholder="08:00-18:00"
                  value={hours[d] || ''}
                  onChange={(e) => setHours({ ...hours, [d]: e.target.value })}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Photo URLs (one per line)</label>
          <textarea
            value={photos}
            onChange={(e) => setPhotos(e.target.value)}
            rows={4}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs"
          />
          <p className="text-xs text-gray-500 mt-1">
            Direct image URLs only. File upload coming soon.
          </p>
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

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {toast && <p className="text-green-600 text-sm">{toast}</p>}

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
