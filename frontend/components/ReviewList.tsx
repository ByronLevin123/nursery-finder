'use client'

import { useEffect, useState, useCallback } from 'react'
import { getReviews, Review } from '@/lib/api'
import ReviewStars from './ReviewStars'

interface Props {
  urn: string
  refreshKey?: number
}

const PAGE_SIZE = 10

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return 'today'
  if (diff < 2 * day) return 'yesterday'
  if (diff < 30 * day) return `${Math.floor(diff / day)} days ago`
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))} months ago`
  return `${Math.floor(diff / (365 * day))} years ago`
}

export default function ReviewList({ urn, refreshKey = 0 }: Props) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [total, setTotal] = useState(0)
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [recommendPct, setRecommendPct] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (offset: number) => {
      const data = await getReviews(urn, PAGE_SIZE, offset)
      setTotal(data.total)
      setAvgRating(data.avg_rating != null ? Number(data.avg_rating) : null)
      setRecommendPct(data.recommend_pct != null ? Number(data.recommend_pct) : null)
      return data.reviews
    },
    [urn]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    load(0)
      .then(rows => {
        if (!cancelled) setReviews(rows)
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load reviews')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [load, refreshKey])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const more = await load(reviews.length)
      setReviews(prev => [...prev, ...more])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more reviews')
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading reviews…</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-3 flex-wrap">
          <ReviewStars rating={avgRating ?? 0} size="lg" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {avgRating != null ? avgRating.toFixed(1) : '—'} from {total} review
              {total === 1 ? '' : 's'}
            </p>
            {recommendPct != null && total > 0 && (
              <p className="text-xs text-gray-500">
                {Math.round(recommendPct)}% of parents would recommend
              </p>
            )}
          </div>
        </div>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No reviews yet — be the first.</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map(r => (
            <li key={r.id} className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between gap-2 mb-1">
                <ReviewStars rating={r.rating} size="sm" />
                <span className="text-xs text-gray-400">{relativeDate(r.created_at)}</span>
              </div>
              <h4 className="font-semibold text-gray-900">{r.title}</h4>
              <p className="text-sm text-gray-700 whitespace-pre-line mt-1">{r.body}</p>
              <p className="text-xs text-gray-500 mt-2">
                — {r.author_display_name || 'Anonymous parent'}
                {r.would_recommend ? ' · would recommend' : ' · would not recommend'}
              </p>
            </li>
          ))}
        </ul>
      )}

      {reviews.length < total && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="text-sm text-blue-600 hover:underline disabled:text-gray-400"
        >
          {loadingMore ? 'Loading…' : 'Load more reviews'}
        </button>
      )}
    </div>
  )
}
