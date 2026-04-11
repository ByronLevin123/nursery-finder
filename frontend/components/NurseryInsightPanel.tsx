'use client'

interface DimensionScore {
  key: string
  label: string
  score: number | null | undefined
  icon: string
  color: string
  bgColor: string
  description: string
}

interface Props {
  qualityScore?: number | null
  costScore?: number | null
  availabilityScore?: number | null
  staffScore?: number | null
  sentimentScore?: number | null
}

function scoreLabel(score: number): string {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Average'
  if (score >= 30) return 'Below avg'
  return 'Low'
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-700'
  if (score >= 70) return 'text-green-600'
  if (score >= 50) return 'text-amber-600'
  if (score >= 30) return 'text-orange-600'
  return 'text-red-600'
}

function barColor(score: number): string {
  if (score >= 85) return 'bg-emerald-500'
  if (score >= 70) return 'bg-green-500'
  if (score >= 50) return 'bg-amber-500'
  if (score >= 30) return 'bg-orange-500'
  return 'bg-red-500'
}

function ScoreBar({ dimension }: { dimension: DimensionScore }) {
  const { label, score, icon, description } = dimension

  if (score == null) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-lg w-7 text-center">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">{label}</span>
            <span className="text-xs text-gray-400">No data</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-200 rounded-full" style={{ width: '0%' }} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-lg w-7 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className={`text-xs font-semibold ${scoreColor(score)}`}>
            {score}/100 &middot; {scoreLabel(score)}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

export default function NurseryInsightPanel({
  qualityScore,
  costScore,
  availabilityScore,
  staffScore,
  sentimentScore,
}: Props) {
  const dimensions: DimensionScore[] = [
    {
      key: 'quality',
      label: 'Quality',
      score: qualityScore,
      icon: '🏆',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      description: 'Based on Ofsted grade, inspection recency and enforcement status',
    },
    {
      key: 'cost',
      label: 'Value for Money',
      score: costScore,
      icon: '💷',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Fees compared to the local area average',
    },
    {
      key: 'availability',
      label: 'Availability',
      score: availabilityScore,
      icon: '📋',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      description: 'Current vacancies and upcoming openings',
    },
    {
      key: 'staff',
      label: 'Staffing',
      score: staffScore,
      icon: '👩‍🏫',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Qualifications, experience and staff-to-child ratios',
    },
    {
      key: 'sentiment',
      label: 'Parent Reviews',
      score: sentimentScore,
      icon: '💬',
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      description: 'Ratings, recommendation rate and review volume',
    },
  ]

  const hasAnyScore = dimensions.some((d) => d.score != null)

  if (!hasAnyScore) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-2">Nursery Insight Scores</h2>
        <p className="text-sm text-gray-500 mb-3">
          We score every nursery across 5 dimensions to help you compare at a glance.
        </p>
        <div className="grid grid-cols-5 gap-2">
          {dimensions.map((d) => (
            <div key={d.key} className="text-center">
              <span className="text-lg">{d.icon}</span>
              <p className="text-xs text-gray-400 mt-0.5">{d.label}</p>
              <p className="text-xs text-gray-300">—</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
          Scores are computed from Ofsted data, fees, availability, staffing and reviews. This nursery does not have enough data yet for a score.
        </p>
      </div>
    )
  }

  // Compute overall average of available scores
  const validScores = dimensions.filter((d) => d.score != null).map((d) => d.score!)
  const overallScore = validScores.length > 0
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Nursery Insight Scores</h2>
        {overallScore != null && (
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${overallScore >= 70 ? 'bg-green-50 border border-green-200' : overallScore >= 50 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
            <span className={`text-sm font-bold ${scoreColor(overallScore)}`}>
              {overallScore}
            </span>
            <span className="text-xs text-gray-500">overall</span>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {dimensions.map((d) => (
          <ScoreBar key={d.key} dimension={d} />
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
        Scores are calculated from Ofsted data, parent-reported fees, availability records, staffing data and reviews. Updated nightly.
      </p>
    </div>
  )
}
