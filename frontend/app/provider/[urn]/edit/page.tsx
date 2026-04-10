'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  API_URL,
  getProviderFeatures,
  getNurseryPhotos,
  uploadNurseryPhoto,
  deleteNurseryPhoto,
  getNurseryFees,
  addNurseryFee,
  updateNurseryFee,
  deleteNurseryFee,
} from '@/lib/api'
import type { ProviderFeatures, NurseryPhoto, NurseryFee } from '@/lib/api'

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

const AGE_GROUPS = ['Under 2', '2 years', '3-4 years', '5+ years']
const SESSION_TYPES = ['Full day', 'Half day (AM)', 'Half day (PM)', 'Hourly', 'Weekly', 'Monthly']

function defaultHours(): HoursMap {
  const out: HoursMap = {}
  for (const d of DAYS) {
    const weekend = d.key === 'saturday' || d.key === 'sunday'
    out[d.key] = { open: '07:30', close: '18:00', closed: weekend }
  }
  return out
}

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
      const m = trimmed.match(/^(\d{1,2}:\d{2})\s*[-\u2013]\s*(\d{1,2}:\d{2})$/)
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

function UpgradeBanner({ feature }: { feature: string }) {
  return (
    <div className="relative rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-6 text-center">
      <div className="text-indigo-400 mb-2">
        <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-indigo-700 mb-1">
        Upgrade to Pro to {feature}
      </p>
      <p className="text-xs text-indigo-500 mb-3">
        Pro providers get photo galleries, custom descriptions, fee management, and more.
      </p>
      <Link
        href="/provider/billing"
        className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
      >
        View plans
      </Link>
    </div>
  )
}

export default function ProviderEditPage({ params }: { params: { urn: string } }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [nursery, setNursery] = useState<ProviderNursery | null>(null)
  const [features, setFeatures] = useState<ProviderFeatures | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Basic fields
  const [description, setDescription] = useState('')
  const [hours, setHours] = useState<HoursMap>(defaultHours())
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  // Photo gallery (enhanced)
  const [galleryPhotos, setGalleryPhotos] = useState<NurseryPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadCaption, setUploadCaption] = useState('')

  // Fee management
  const [fees, setFees] = useState<NurseryFee[]>([])
  const [showAddFee, setShowAddFee] = useState(false)
  const [newFee, setNewFee] = useState({ age_group: AGE_GROUPS[0], session_type: SESSION_TYPES[0], price_gbp: '', notes: '' })
  const [addingFee, setAddingFee] = useState(false)

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
        // Load nursery data, features, photos, and fees in parallel
        const [nurseryRes, feat, photos, feeList] = await Promise.all([
          fetch(`${API_URL}/api/v1/provider/nurseries`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          getProviderFeatures(session.access_token),
          getNurseryPhotos(params.urn),
          getNurseryFees(params.urn),
        ])

        if (!nurseryRes.ok) throw new Error('failed')
        const j = await nurseryRes.json()
        const found = (j.data || []).find((n: ProviderNursery) => n.urn === params.urn)
        if (!found) {
          setError('You do not own this nursery (or it does not exist).')
          setLoading(false)
          return
        }

        setNursery(found)
        setFeatures(feat)
        setDescription(found.description || '')
        setHours(normaliseHours(found.opening_hours))
        setWebsiteUrl(found.website_url || '')
        setContactEmail(found.contact_email || '')
        setContactPhone(found.contact_phone || '')
        setGalleryPhotos(photos)
        setFees(feeList)
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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return
      const photo = await uploadNurseryPhoto(session.access_token, params.urn, file, uploadCaption || undefined)
      setGalleryPhotos((prev) => [...prev, photo])
      setUploadCaption('')
      setToast('Photo uploaded')
      setTimeout(() => setToast(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handlePhotoDelete(photoId: string) {
    if (!confirm('Delete this photo?')) return
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return
      await deleteNurseryPhoto(session.access_token, params.urn, photoId)
      setGalleryPhotos((prev) => prev.filter((p) => p.id !== photoId))
      setToast('Photo deleted')
      setTimeout(() => setToast(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Delete failed')
    }
  }

  async function handleAddFee() {
    if (!newFee.price_gbp || isNaN(Number(newFee.price_gbp))) {
      setError('Please enter a valid price')
      return
    }
    setAddingFee(true)
    setError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return
      const fee = await addNurseryFee(session.access_token, params.urn, {
        age_group: newFee.age_group,
        session_type: newFee.session_type,
        price_gbp: Number(newFee.price_gbp),
        notes: newFee.notes || undefined,
      })
      setFees((prev) => [...prev, fee])
      setShowAddFee(false)
      setNewFee({ age_group: AGE_GROUPS[0], session_type: SESSION_TYPES[0], price_gbp: '', notes: '' })
      setToast('Fee added')
      setTimeout(() => setToast(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to add fee')
    }
    setAddingFee(false)
  }

  async function handleDeleteFee(feeId: string) {
    if (!confirm('Delete this fee row?')) return
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return
      await deleteNurseryFee(session.access_token, params.urn, feeId)
      setFees((prev) => prev.filter((f) => f.id !== feeId))
      setToast('Fee deleted')
      setTimeout(() => setToast(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete fee')
    }
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

      const body: Record<string, any> = {
        opening_hours: hours,
        website_url: websiteUrl,
        contact_email: contactEmail,
        contact_phone: contactPhone,
      }
      // Only include description if user has paid tier
      if (features?.can_edit_description) {
        body.description = description
      }

      const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${params.urn}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      if (res.status === 403) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'You do not own this nursery')
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

  const isPaid = features && (features.tier === 'pro' || features.tier === 'premium')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Edit {nursery.name}</h1>
      {features && (
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            features.tier === 'premium'
              ? 'bg-amber-100 text-amber-800'
              : features.tier === 'pro'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600'
          }`}>
            {features.tier.charAt(0).toUpperCase() + features.tier.slice(1)} plan
          </span>
          {!isPaid && (
            <Link href="/provider/billing" className="text-xs text-indigo-600 hover:underline">
              Upgrade for enhanced features
            </Link>
          )}
        </div>
      )}
      {nursery.provider_updated_at && (
        <p className="text-xs text-gray-500 mb-6">
          Last updated {new Date(nursery.provider_updated_at).toLocaleString('en-GB')}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Description — gated behind paid tier */}
        <div>
          <label className="text-sm font-medium text-gray-700">About this nursery</label>
          {features?.can_edit_description ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={5000}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Tell parents what makes your nursery special..."
            />
          ) : (
            <div className="mt-1">
              <UpgradeBanner feature="add a custom description" />
            </div>
          )}
        </div>

        {/* Opening hours — always available */}
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

        {/* Photo Gallery — gated behind paid tier */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Photo gallery {features?.can_upload_photos && `(${galleryPhotos.length}/${features.photo_limit})`}
          </label>
          {features?.can_upload_photos ? (
            <div>
              {/* Existing photos grid */}
              {galleryPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {galleryPhotos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.public_url}
                        alt={photo.caption || 'Nursery photo'}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200"
                      />
                      {photo.caption && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{photo.caption}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => handlePhotoDelete(photo.id)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete photo"
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload area */}
              {galleryPhotos.length < (features.photo_limit || 20) && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">Select image (JPEG, PNG, WebP, max 5MB)</label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handlePhotoUpload}
                        disabled={uploading}
                        className="text-sm file:mr-3 file:px-3 file:py-1.5 file:border-0 file:rounded-lg file:bg-blue-50 file:text-blue-700 file:font-medium file:cursor-pointer hover:file:bg-blue-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Caption (optional)</label>
                      <input
                        type="text"
                        value={uploadCaption}
                        onChange={(e) => setUploadCaption(e.target.value)}
                        placeholder="e.g. Our outdoor play area"
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-full"
                        maxLength={200}
                      />
                    </div>
                  </div>
                  {uploading && (
                    <p className="text-xs text-blue-600 mt-2">Uploading...</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <UpgradeBanner feature="add a photo gallery" />
          )}
        </div>

        {/* Fee Management — gated behind paid tier */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Fee schedule</label>
          {features?.can_manage_fees ? (
            <div>
              {fees.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Age group</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Session</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">Price</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Notes</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {fees.map((fee) => (
                        <tr key={fee.id}>
                          <td className="px-3 py-2">{fee.age_group}</td>
                          <td className="px-3 py-2">{fee.session_type}</td>
                          <td className="px-3 py-2 text-right font-medium">
                            {'\u00A3'}{Number(fee.price_gbp).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{fee.notes || '-'}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteFee(fee.id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {fees.length === 0 && !showAddFee && (
                <p className="text-xs text-gray-500 mb-2">No fees added yet. Add your fee schedule so parents can see your pricing.</p>
              )}

              {showAddFee ? (
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Age group</label>
                      <select
                        value={newFee.age_group}
                        onChange={(e) => setNewFee((p) => ({ ...p, age_group: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      >
                        {AGE_GROUPS.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Session type</label>
                      <select
                        value={newFee.session_type}
                        onChange={(e) => setNewFee((p) => ({ ...p, session_type: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      >
                        {SESSION_TYPES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Price (GBP)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newFee.price_gbp}
                        onChange={(e) => setNewFee((p) => ({ ...p, price_gbp: e.target.value }))}
                        placeholder="55.00"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Notes (optional)</label>
                      <input
                        type="text"
                        value={newFee.notes}
                        onChange={(e) => setNewFee((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="e.g. Includes meals"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddFee}
                      disabled={addingFee}
                      className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {addingFee ? 'Adding...' : 'Add fee'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddFee(false)}
                      className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddFee(true)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  + Add fee row
                </button>
              )}
            </div>
          ) : (
            <UpgradeBanner feature="manage your fee schedule" />
          )}
        </div>

        {/* Contact info — always available */}
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
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
