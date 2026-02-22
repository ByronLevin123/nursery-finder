import Link from 'next/link'
import GradeBadge from './GradeBadge'
import { Nursery } from '@/lib/api'
import ShortlistButton from './ShortlistButton'

interface Props {
  nursery: Nursery
  showDistance?: boolean
}

export default function NurseryCard({ nursery, showDistance = true }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start gap-2 mb-2">
        <Link
          href={`/nursery/${nursery.urn}`}
          className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-2 flex-1"
        >
          {nursery.name}
        </Link>
        <ShortlistButton urn={nursery.urn} />
      </div>

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <GradeBadge grade={nursery.ofsted_overall_grade} size="sm" />
        {nursery.inspection_date_warning && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            ⚠️ Old inspection
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-2">
        {nursery.address_line1 && `${nursery.address_line1}, `}{nursery.town}
      </p>

      <div className="flex gap-3 text-xs text-gray-600 flex-wrap">
        {nursery.total_places && (
          <span>🏫 {nursery.total_places} places</span>
        )}
        {nursery.places_funded_2yr && nursery.places_funded_2yr > 0 && (
          <span className="text-green-700">✓ 2yr funded</span>
        )}
        {nursery.places_funded_3_4yr && nursery.places_funded_3_4yr > 0 && (
          <span className="text-green-700">✓ 3-4yr funded</span>
        )}
        {showDistance && nursery.distance_km != null && (
          <span>📍 {nursery.distance_km.toFixed(1)}km away</span>
        )}
        {nursery.fee_avg_monthly && nursery.fee_report_count >= 3 && (
          <span>💷 ~£{nursery.fee_avg_monthly}/mo</span>
        )}
      </div>

      {nursery.last_inspection_date && (
        <p className="text-xs text-gray-400 mt-2">
          Inspected {new Date(nursery.last_inspection_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}
