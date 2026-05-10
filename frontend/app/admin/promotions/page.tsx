'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, API_URL } from '@/lib/api'

const CATEGORIES = [
  'swimming',
  'music',
  'tutoring',
  'baby_gear',
  'dance',
  'sports',
  'soft_play',
  'arts',
  'language',
  'childcare',
  'health',
  'other',
] as const

type Category = (typeof CATEGORIES)[number]

interface Promotion {
  id: string
  title: string
  description: string | null
  image_url: string | null
  link_url: string
  category: Category
  postcode_district: string | null
  radius_km: number | null
  start_date: string | null
  end_date: string | null
  active: boolean
  impressions: number
  clicks: number
  created_at: string
}

interface FormData {
  title: string
  description: string
  image_url: string
  link_url: string
  category: Category | ''
  postcode_district: string
  radius_km: string
  start_date: string
  end_date: string
}

const EMPTY_FORM: FormData = {
  title: '',
  description: '',
  image_url: '',
  link_url: '',
  category: '',
  postcode_district: '',
  radius_km: '',
  start_date: '',
  end_date: '',
}

function categoryLabel(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function AdminPromotionsPage() {
  const { role } = useSession()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (role !== 'admin') return null

  async function authHeaders(): Promise<HeadersInit> {
    const token = await getAuthToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  async function fetchPromotions() {
    try {
      setLoading(true)
      const headers = await authHeaders()
      const res = await fetch(`${API_URL}/api/v1/admin/promotions`, { headers })
      if (!res.ok) throw new Error('Failed to load promotions')
      const data = await res.json()
      setPromotions(Array.isArray(data) ? data : data.promotions ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    fetchPromotions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowModal(true)
  }

  function openEdit(promo: Promotion) {
    setEditingId(promo.id)
    setForm({
      title: promo.title,
      description: promo.description ?? '',
      image_url: promo.image_url ?? '',
      link_url: promo.link_url,
      category: promo.category,
      postcode_district: promo.postcode_district ?? '',
      radius_km: promo.radius_km != null ? String(promo.radius_km) : '',
      start_date: promo.start_date ? promo.start_date.slice(0, 10) : '',
      end_date: promo.end_date ? promo.end_date.slice(0, 10) : '',
    })
    setFormError(null)
    setShowModal(true)
  }

  function validate(): string | null {
    if (!form.title.trim()) return 'Title is required'
    if (!form.link_url.trim()) return 'Link URL is required'
    if (!form.category) return 'Category is required'
    try {
      new URL(form.link_url)
    } catch {
      return 'Link URL must be a valid URL'
    }
    if (form.image_url.trim()) {
      try {
        new URL(form.image_url)
      } catch {
        return 'Image URL must be a valid URL'
      }
    }
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const headers = await authHeaders()
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        link_url: form.link_url.trim(),
        category: form.category,
        postcode_district: form.postcode_district.trim() || null,
        radius_km: form.radius_km ? Number(form.radius_km) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      }

      const url = editingId
        ? `${API_URL}/api/v1/admin/promotions/${editingId}`
        : `${API_URL}/api/v1/admin/promotions`
      const method = editingId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to save promotion')
      }
      setShowModal(false)
      fetchPromotions()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(promo: Promotion) {
    try {
      const headers = await authHeaders()
      await fetch(`${API_URL}/api/v1/admin/promotions/${promo.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ active: !promo.active }),
      })
      setPromotions((prev) =>
        prev.map((p) => (p.id === promo.id ? { ...p, active: !p.active } : p))
      )
    } catch {
      // silently fail, user can retry
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this promotion?')) return
    try {
      const headers = await authHeaders()
      await fetch(`${API_URL}/api/v1/admin/promotions/${id}`, {
        method: 'DELETE',
        headers,
      })
      setPromotions((prev) => prev.filter((p) => p.id !== id))
    } catch {
      // silently fail
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          Create promotion
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : promotions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No promotions yet. Create your first one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium text-center">Active</th>
                  <th className="px-4 py-3 font-medium text-right">Impressions</th>
                  <th className="px-4 py-3 font-medium text-right">Clicks</th>
                  <th className="px-4 py-3 font-medium">Start</th>
                  <th className="px-4 py-3 font-medium">End</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {promotions.map((promo) => (
                  <tr key={promo.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                      {promo.title}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full">
                        {categoryLabel(promo.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(promo)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                          promo.active ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                        title={promo.active ? 'Active' : 'Inactive'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition transform ${
                            promo.active ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      {(promo.impressions ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      {(promo.clicks ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {promo.start_date ? promo.start_date.slice(0, 10) : '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {promo.end_date ? promo.end_date.slice(0, 10) : '--'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => openEdit(promo)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(promo.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
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
      </div>

      {/* Modal overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit promotion' : 'Create promotion'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="e.g. 50% off swimming lessons"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                  placeholder="Short description of the promotion"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL
                </label>
                <input
                  type="text"
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.link_url}
                  onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value as Category | '' }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {categoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postcode district
                  </label>
                  <input
                    type="text"
                    value={form.postcode_district}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, postcode_district: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="e.g. SW1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Radius (km)
                  </label>
                  <input
                    type="number"
                    value={form.radius_km}
                    onChange={(e) => setForm((f) => ({ ...f, radius_km: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="e.g. 10"
                    min={0}
                    step="any"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End date
                  </label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
