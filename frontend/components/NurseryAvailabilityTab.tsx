'use client'

import { useState, useEffect } from 'react'
import { API_URL } from '@/lib/api'
import type { NurseryAvailability } from '@/lib/api'

interface Props {
  urn: string
}

export default function NurseryAvailabilityTab({ urn }: Props) {
  const [rows, setRows] = useState<NurseryAvailability[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/v1/nurseries/${urn}/availability`)
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

  if (rows.length === 0) {
    return null
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <h2 className="font-semibold text-gray-900 mb-3">Availability</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="pb-2 pr-4">Age group</th>
              <th className="pb-2 pr-4">Spots available</th>
              <th className="pb-2 pr-4">Waitlist</th>
              <th className="pb-2">Next available</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-gray-100">
                <td className="py-2 pr-4 text-gray-700">{row.age_group}</td>
                <td className="py-2 pr-4">
                  {row.spots_available > 0 ? (
                    <span className="text-green-600 font-medium">
                      {row.spots_available} available
                    </span>
                  ) : (
                    <span className="text-red-500">Full</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-gray-700">
                  {row.waitlist_length > 0 ? (
                    <span className="text-amber-600">{row.waitlist_length} on waitlist</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="py-2 text-gray-700">
                  {row.next_available_date
                    ? new Date(row.next_available_date).toLocaleDateString('en-GB', {
                        month: 'short',
                        year: 'numeric',
                      })
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows[0]?.updated_at && (
          <p className="text-xs text-gray-400 mt-2">
            Last updated: {new Date(rows[0].updated_at).toLocaleDateString('en-GB')}
          </p>
        )}
      </div>
    </div>
  )
}
