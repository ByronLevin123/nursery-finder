'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, adminFetch } from '@/lib/api'

interface AdminEnquiry {
  id: string
  nursery_name: string | null
  urn: string
  parent_email: string
  parent_name: string | null
  child_name: string | null
  status: string
  created_at: string
}

interface Meta {
  total: number
  page: number
  limit: number
  pages: number
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    sent: 'bg-green-100 text-green-700',
    read: 'bg-emerald-100 text-emerald-700',
    replied: 'bg-indigo-100 text-indigo-700',
    expired: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${colours[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default function AdminEnquiriesPage() {
  const { role } = useSession()
  const [enquiries, setEnquiries] = useState<AdminEnquiry[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 25, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    setError('')
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('No auth token')
      const params = new URLSearchParams({ page: String(p), limit: '25' })
      const data = await adminFetch(`/enquiries?${params}`, token)
      setEnquiries(data.data || [])
      setMeta(data.meta || { total: 0, page: p, limit: 25, pages: 1 })
    } catch (e: any) {
      setError(e.message || 'Failed to load enquiries')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role !== 'admin') return
    load(page)
  }, [role, page, load])

  if (role !== 'admin') return null

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">Enquiries</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
              <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-32 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : enquiries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No enquiries yet</p>
          <p className="text-sm">Enquiries from parents will appear here.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="px-4 py-3 font-semibold">Nursery</th>
                    <th className="px-4 py-3 font-semibold">Parent Email</th>
                    <th className="px-4 py-3 font-semibold">Child Name</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {enquiries.map((e, i) => (
                    <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-medium text-gray-900">{e.nursery_name || e.urn}</td>
                      <td className="px-4 py-3 text-gray-600">{e.parent_email}</td>
                      <td className="px-4 py-3 text-gray-600">{e.child_name || '--'}</td>
                      <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(e.created_at).toLocaleDateString('en-GB')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {enquiries.map((e) => (
              <div key={e.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-medium text-gray-900 text-sm">{e.nursery_name || e.urn}</p>
                  <StatusBadge status={e.status} />
                </div>
                <p className="text-sm text-gray-600">{e.parent_email}</p>
                {e.child_name && <p className="text-xs text-gray-500 mt-1">Child: {e.child_name}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(e.created_at).toLocaleDateString('en-GB')}
                </p>
              </div>
            ))}
          </div>

          <Pagination meta={meta} page={page} setPage={setPage} />
        </>
      )}
    </div>
  )
}

function Pagination({
  meta,
  page,
  setPage,
}: {
  meta: Meta
  page: number
  setPage: (p: number) => void
}) {
  if (meta.pages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <p className="text-gray-500">
        Page {meta.page} of {meta.pages} ({meta.total} total)
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition"
        >
          Prev
        </button>
        <button
          onClick={() => setPage(page + 1)}
          disabled={page >= meta.pages}
          className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition"
        >
          Next
        </button>
      </div>
    </div>
  )
}
