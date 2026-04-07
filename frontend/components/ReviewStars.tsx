interface Props {
  rating: number
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASS: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
}

export default function ReviewStars({ rating, size = 'md' }: Props) {
  const safe = Math.max(0, Math.min(5, Math.round(rating || 0)))
  return (
    <span
      className={`inline-flex items-center ${SIZE_CLASS[size]}`}
      aria-label={`${safe} out of 5 stars`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= safe ? 'text-yellow-500' : 'text-gray-300'}>
          ★
        </span>
      ))}
    </span>
  )
}
