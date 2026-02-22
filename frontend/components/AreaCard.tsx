import Link from 'next/link'

interface AreaData {
  postcode_district: string
  local_authority?: string
  family_score?: number
  nursery_count_total?: number
  nursery_count_outstanding?: number
  nursery_outstanding_pct?: number
  crime_rate_per_1000?: number
  flood_risk_level?: string
  distance_km?: number
}

interface Props {
  area: AreaData
}

function getScoreColor(score: number | undefined): string {
  if (!score) return 'text-gray-400'
  if (score >= 8) return 'text-green-600'
  if (score >= 6) return 'text-blue-600'
  if (score >= 4) return 'text-amber-600'
  return 'text-red-600'
}

function getCrimeBadge(rate: number | undefined): { label: string; color: string } {
  if (!rate) return { label: 'No data', color: 'bg-gray-100 text-gray-600' }
  if (rate < 20) return { label: 'Very Low', color: 'bg-green-100 text-green-800' }
  if (rate < 40) return { label: 'Low', color: 'bg-blue-100 text-blue-800' }
  if (rate < 60) return { label: 'Medium', color: 'bg-amber-100 text-amber-800' }
  return { label: 'High', color: 'bg-red-100 text-red-800' }
}

export default function AreaCard({ area }: Props) {
  const crime = getCrimeBadge(area.crime_rate_per_1000)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <Link
            href={`/nurseries-in/${area.postcode_district.toLowerCase()}`}
            className="text-lg font-bold text-gray-900 hover:text-blue-600"
          >
            {area.postcode_district}
          </Link>
          {area.local_authority && (
            <p className="text-sm text-gray-500">{area.local_authority}</p>
          )}
        </div>
        {area.family_score != null && (
          <div className="text-center">
            <p className={`text-2xl font-bold ${getScoreColor(area.family_score)}`}>
              {area.family_score}
            </p>
            <p className="text-xs text-gray-400">Family Score</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {area.nursery_count_total != null && (
          <div>
            <span className="text-gray-500">Nurseries:</span>{' '}
            <span className="font-medium">{area.nursery_count_total}</span>
          </div>
        )}
        {area.nursery_outstanding_pct != null && (
          <div>
            <span className="text-gray-500">Outstanding:</span>{' '}
            <span className="font-medium text-green-700">{area.nursery_outstanding_pct}%</span>
          </div>
        )}
        <div>
          <span className="text-gray-500">Crime:</span>{' '}
          <span className={`text-xs px-2 py-0.5 rounded-full ${crime.color}`}>{crime.label}</span>
        </div>
        {area.flood_risk_level && (
          <div>
            <span className="text-gray-500">Flood:</span>{' '}
            <span className="font-medium">{area.flood_risk_level}</span>
          </div>
        )}
      </div>

      {area.distance_km != null && (
        <p className="text-xs text-gray-400 mt-2">📍 {area.distance_km.toFixed(1)}km away</p>
      )}

      <Link
        href={`/nurseries-in/${area.postcode_district.toLowerCase()}`}
        className="inline-block mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        View area →
      </Link>
    </div>
  )
}
