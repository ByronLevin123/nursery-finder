'use client'

import { useState, useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface AvailabilityRow {
  id: string
  age_group: string
  total_capacity: number | null
  current_enrolled: number
  waitlist_count: number
  next_available: string | null
  next_intake: string | null
  updated_at: string
}

interface Props {
  urn: string
}

export default function NurseryAvailabilityTab({ urn }: Props) {
  const [rows, setRows] = useState<AvailabilityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${urn}/availability`)
        if (res.ok) {
          const data = await res.json()
          setRows(data.data || [])
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [urn])

  if (loading) {
    return <div className="py-4 text-sm text-gray-500">Loading availability...</div>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <h2 className="font-semibold text-gray-900 mb-3">Availability</h2>

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="pb-2 pr-4">Age group</th>
                <th className="pb-2 pr-4">Vacancies</th>
                <th className="pb-2 pr-4">Waitlist</th>
                <th className="pb-2">Next available</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const vacancies = row.total_capacity
                  ? Math.max(0, row.total_capacity - row.current_enrolled)
                  : null
                return (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="py-2 pr-4 text-gray-700">{row.age_group}</td>
                    <td className="py-2 pr-4">
                      {vacancies != null ? (
                        <span className={vacancies > 0 ? 'text-green-600 font-medium' : 'text-red-500'}>
                          {vacancies > 0 ? `${vacancies} available` : 'Full'}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {row.waitlist_count > 0 ? `${row.waitlist_count} on waitlist` : '-'}
                    </td>
                    <td className="py-2 text-gray-700">
                      {row.next_available
                        ? new Date(row.next_available).toLocaleDateString('en-GB', {
                            month: 'short',
                            year: 'numeric',
                          })
                        : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows[0]?.updated_at && (
            <p className="text-xs text-gray-400 mt-2">
              Last updated: {new Date(rows[0].updated_at).toLocaleDateString('en-GB')}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          No availability data yet. Contact the nursery directly to ask about places.
        </p>
      )}
    </div>
  )
}
