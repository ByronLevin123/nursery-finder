interface Props {
  score: number | null
  excluded?: boolean
  size?: 'sm' | 'md'
}

export default function MatchBadge({ score, excluded, size = 'sm' }: Props) {
  if (excluded) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-100 text-gray-500 font-medium ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}>
        Excluded
      </span>
    )
  }
  if (score == null) return null

  let color = 'bg-red-100 text-red-800 border-red-200'
  if (score >= 85) color = 'bg-green-100 text-green-800 border-green-200'
  else if (score >= 65) color = 'bg-indigo-100 text-indigo-800 border-indigo-200'
  else if (score >= 45) color = 'bg-amber-100 text-amber-800 border-amber-200'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${color} ${
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
    }`}>
      {score}% match
    </span>
  )
}
