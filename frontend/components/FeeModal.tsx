'use client'

import { useState } from 'react'
import { submitFee } from '@/lib/api'

interface Props {
  nurseryId: string
}

export default function FeeModal({ nurseryId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [feePerMonth, setFeePerMonth] = useState('')
  const [hoursPerWeek, setHoursPerWeek] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const fee = parseInt(feePerMonth)
    if (!fee || fee < 100 || fee > 5000) {
      setError('Please enter a monthly fee between £100 and £5,000')
      return
    }

    try {
      await submitFee({
        nursery_urn: nurseryId,
        fee_per_month: fee,
        hours_per_week: hoursPerWeek ? parseInt(hoursPerWeek) : undefined,
        age_group: ageGroup || undefined,
      })
      setSubmitted(true)
    } catch {
      setError('Failed to submit fee. Please try again.')
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        Know the fees? Help other parents →
      </button>
    )
  }

  if (submitted) {
    return (
      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
        Thank you! Your anonymous fee submission helps other parents.
      </div>
    )
  }

  return (
    <div className="mt-3 p-4 bg-white border border-gray-200 rounded-lg">
      <h4 className="font-medium text-sm mb-3">Submit fee (anonymous)</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-gray-500">Monthly fee (£) *</label>
          <input
            type="number"
            value={feePerMonth}
            onChange={e => setFeePerMonth(e.target.value)}
            placeholder="e.g. 1200"
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Hours per week</label>
          <input
            type="number"
            value={hoursPerWeek}
            onChange={e => setHoursPerWeek(e.target.value)}
            placeholder="e.g. 25"
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Child&apos;s age group</label>
          <select
            value={ageGroup}
            onChange={e => setAgeGroup(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">Select...</option>
            <option value="0-2">Under 2</option>
            <option value="2-3">2-3 years</option>
            <option value="3-5">3-5 years</option>
          </select>
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
            Submit
          </button>
          <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-500 text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
