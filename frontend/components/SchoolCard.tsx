import Link from 'next/link'
import GradeBadge from './GradeBadge'
import ShortlistButton from './ShortlistButton'
import { School } from '@/lib/api'

interface Props {
  school: School
  showDistance?: boolean
  onClick?: () => void
}

const PHASE_STYLES: Record<string, string> = {
  Primary: 'bg-purple-50 text-purple-700 border-purple-200',
  Secondary: 'bg-orange-50 text-orange-700 border-orange-200',
  'All-through': 'bg-cyan-50 text-cyan-700 border-cyan-200',
}

export default function SchoolCard({ school, showDistance = true, onClick }: Props) {
  const phaseStyle = school.phase ? PHASE_STYLES[school.phase] || 'bg-gray-50 text-gray-700 border-gray-200' : null

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex justify-between items-start gap-2 mb-2">
          {onClick ? (
            <button
              onClick={onClick}
              className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-2 flex-1 text-left"
            >
              {school.name}
            </button>
          ) : (
            <Link
              href={`/school/${school.urn}`}
              className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-2 flex-1"
            >
              {school.name}
            </Link>
          )}
          <ShortlistButton urn={school.urn} type="school" />
        </div>

        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <GradeBadge grade={school.ofsted_rating} size="sm" />
          {phaseStyle && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${phaseStyle}`}>
              {school.phase}
            </span>
          )}
          {school.type && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
              {school.type}
            </span>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-2">
          {school.address && `${school.address}, `}{school.town}
        </p>

        <div className="flex gap-3 text-xs text-gray-600 flex-wrap">
          {school.pupils && (
            <span>{school.pupils.toLocaleString()} pupils</span>
          )}
          {school.age_range && (
            <span>Ages {school.age_range}</span>
          )}
          {showDistance && school.distance_km != null && (
            <span>{school.distance_km.toFixed(1)}km away</span>
          )}
        </div>
      </div>
    </div>
  )
}
