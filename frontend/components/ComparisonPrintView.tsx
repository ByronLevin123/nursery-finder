'use client'

import { Nursery } from '@/lib/api'

interface Props {
  nurseries: Nursery[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatFee(n: Nursery): string {
  if (n.fee_avg_monthly && n.fee_report_count >= 3) {
    return `£${n.fee_avg_monthly}/mo`
  }
  return 'No data'
}

function formatAddress(n: Nursery): string {
  return [n.address_line1, n.town, n.postcode].filter(Boolean).join(', ')
}

type RowDef = {
  label: string
  value: (n: Nursery) => string
}

const rows: RowDef[] = [
  { label: 'Ofsted Grade', value: n => n.ofsted_overall_grade || 'N/A' },
  { label: 'Address', value: n => formatAddress(n) },
  { label: 'Phone', value: n => n.phone || n.contact_phone || 'N/A' },
  { label: 'Total Places', value: n => n.total_places != null ? String(n.total_places) : 'N/A' },
  { label: 'Funded 2yr Places', value: n => n.places_funded_2yr && n.places_funded_2yr > 0 ? String(n.places_funded_2yr) : 'None' },
  { label: 'Funded 3-4yr Places', value: n => n.places_funded_3_4yr && n.places_funded_3_4yr > 0 ? String(n.places_funded_3_4yr) : 'None' },
  {
    label: 'Google Rating',
    value: n => {
      if (n.google_rating != null) {
        const reviews = n.google_review_count != null ? ` (${n.google_review_count} reviews)` : ''
        return `${n.google_rating}/5${reviews}`
      }
      return 'N/A'
    },
  },
  { label: 'Avg Monthly Fee', value: n => formatFee(n) },
  { label: 'Last Inspection', value: n => formatDate(n.last_inspection_date) },
]

export default function ComparisonPrintView({ nurseries }: Props) {
  const now = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="hidden print:block print:p-0 print:m-0">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Nursery Comparison — CompareTheNursery
        </h1>
        <p className="text-sm text-gray-500 mt-1">Generated on {now}</p>
      </div>

      {/* Comparison table */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-gray-300 bg-gray-100 p-2 text-left text-xs font-semibold text-gray-600 uppercase">
              Attribute
            </th>
            {nurseries.map(n => (
              <th
                key={n.urn}
                className="border border-gray-300 bg-gray-100 p-2 text-left text-xs font-semibold text-gray-900"
              >
                {n.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label}>
              <td className="border border-gray-300 p-2 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap bg-gray-50">
                {row.label}
              </td>
              {nurseries.map(n => (
                <td key={n.urn} className="border border-gray-300 p-2 text-sm text-gray-800">
                  {row.value(n)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
        Generated from comparethenursery.com
      </div>
    </div>
  )
}
