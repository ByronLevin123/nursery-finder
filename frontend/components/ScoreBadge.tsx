interface Props {
  score: number | null | undefined
  size?: 'sm' | 'md'
}

export default function ScoreBadge({ score, size = 'sm' }: Props) {
  if (score == null) return null

  const colorClass =
    score >= 85
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : score >= 70
        ? 'bg-green-50 text-green-700 border-green-200'
        : score >= 50
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-red-50 text-red-700 border-red-200'

  const label =
    score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Average' : 'Below avg'

  if (size === 'md') {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold border ${colorClass}`}>
        <span>{score}</span>
        <span className="text-xs font-normal opacity-75">{label}</span>
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}
      title={`Insight score: ${score}/100 (${label})`}
    >
      {score}
    </span>
  )
}
