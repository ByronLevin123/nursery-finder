'use client'

import { useState, useEffect } from 'react'
import { API_URL } from '@/lib/api'

interface PricingRow {
  id: string
  age_group: string
  session_type: string
  fee_per_month: number | null
  hours_per_week: number | null
  meals_included: boolean
  source: string
}

interface Props {
  urn: string
  nurseryId: string
}

const SESSION_LABELS: Record<string, string> = {
  full_day: 'Full day',
  half_day_am: 'Half day (AM)',
  half_day_pm: 'Half day (PM)',
  flexible: 'Flexible',
}

export default function NurseryPricingTab({ urn, nurseryId }: Props) {
  const [pricing, setPricing] = useState<PricingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formFee, setFormFee] = useState('')
  const [formAge, setFormAge] = useState('2-3')
  const [formSession, setFormSession] = useState('full_day')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${urn}/pricing`)
        if (res.ok) {
          const data = await res.json()
          setPricing(data.data || [])
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [urn])

  async function handleCrowdsource() {
    if (!formFee) return
    setSubmitting(true)
    setSubmitMsg('')
    try {
      const res = await fetch(`${API_URL}/api/v1/nurseries/fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nursery_urn: nurseryId,
          fee_per_month: Number(formFee),
          age_group: formAge,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setSubmitMsg('Thank you! Your fee report has been submitted.')
      setShowForm(false)
      setFormFee('')
    } catch {
      setSubmitMsg('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="py-4 text-sm text-gray-500">Loading pricing...</div>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <h2 className="font-semibold text-gray-900 mb-3">Pricing</h2>

      {pricing.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="pb-2 pr-4">Age group</th>
                <th className="pb-2 pr-4">Session</th>
                <th className="pb-2 pr-4">Monthly fee</th>
                <th className="pb-2">Meals</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{row.age_group}</td>
                  <td className="py-2 pr-4 text-gray-700">{SESSION_LABELS[row.session_type] || row.session_type}</td>
                  <td className="py-2 pr-4 text-gray-900 font-medium">
                    {row.fee_per_month != null ? `\u00A3${row.fee_per_month}` : '-'}
                  </td>
                  <td className="py-2 text-gray-700">{row.meals_included ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pricing[0]?.source === 'provider' && (
            <p className="text-xs text-gray-400 mt-2">Provided by the nursery</p>
          )}
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-500 mb-3">No pricing data available yet.</p>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="text-sm text-indigo-600 hover:underline"
            >
              Help other parents — submit what you pay
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={formFee}
                  onChange={(e) => setFormFee(e.target.value)}
                  placeholder="Monthly fee"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
                <select
                  value={formAge}
                  onChange={(e) => setFormAge(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="0-1">0-1</option>
                  <option value="1-2">1-2</option>
                  <option value="2-3">2-3</option>
                  <option value="3-4">3-4</option>
                  <option value="4-5">4-5</option>
                </select>
              </div>
              <button
                onClick={handleCrowdsource}
                disabled={submitting || !formFee}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          )}
        </div>
      )}

      {submitMsg && <p className="text-sm text-green-600 mt-2">{submitMsg}</p>}
    </div>
  )
}
