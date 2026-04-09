'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, adminFetch } from '@/lib/api'

interface AdminUser {
  id: string
  email: string
  display_name: string | null
  role: string
  created_at: string
}

interface Meta {
  total: number
  page: number
  limit: number
  pages: number
}

export default function AdminUsersPage() {
  const { role } = useSession()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 25, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (s: string, r: string, p: number) => {
    setLoading(true)
    setError('')
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('No auth token')
      const params = new URLSearchParams({ page: String(p), limit: '25' })
      if (s) params.set('search', s)
      if (r) params.set('role', r)
      const data = await adminFetch(`/users?${params}`, token)
      setUsers(data.data || [])
      setMeta(data.meta || { total: 0, page: p, limit: 25, pages: 1 })
    } catch (e: any) {
      setError(e.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role !== 'admin') return
    load(search, roleFilter, page)
  }, [role, roleFilter, page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (role !== 'admin') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      load(search, roleFilter, 1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  async function changeRole(userId: string, newRole: string) {
    if (!confirm(`Change this user's role to "${newRole}"?`)) return
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('No auth token')
      await adminFetch(`/users/${userId}/role`, token, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      })
      load(search, roleFilter, page)
    } catch (e: any) {
      setError(e.message || 'Failed to change role')
    }
  }

  if (role !== 'admin') return null

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">Users</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All roles</option>
          <option value="customer">Customer</option>
          <option value="provider">Provider</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
              <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-32 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No users found</p>
          <p className="text-sm">Try adjusting your search or filter.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Display Name</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-medium text-gray-900">{u.email}</td>
                      <td className="px-4 py-3 text-gray-600">{u.display_name || '--'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          className="text-xs px-2 py-1 border border-gray-300 rounded bg-white"
                        >
                          <option value="customer">customer</option>
                          <option value="provider">provider</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(u.created_at).toLocaleDateString('en-GB')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {users.map((u) => (
              <div key={u.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="font-medium text-gray-900 text-sm">{u.email}</p>
                <p className="text-xs text-gray-500 mb-2">{u.display_name || '--'}</p>
                <div className="flex items-center justify-between">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="text-xs px-2 py-1 border border-gray-300 rounded bg-white"
                  >
                    <option value="customer">customer</option>
                    <option value="provider">provider</option>
                    <option value="admin">admin</option>
                  </select>
                  <span className="text-xs text-gray-400">
                    {new Date(u.created_at).toLocaleDateString('en-GB')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
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
