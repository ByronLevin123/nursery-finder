'use client'

import { useState } from 'react'
import { submitReview } from '@/lib/api'

interface Props {
  urn: string
  onSuccess?: () => void
}

export default function ReviewForm({ urn, onSuccess }: Props) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null)
  const [childAgeMonths, setChildAgeMonths] = useState('')
  const [attendedFrom, setAttendedFrom] = useState('')
  const [attendedTo, setAttendedTo] = useState('')
  const [authorDisplayName, setAuthorDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function validate(): string | null {
    if (rating < 1 || rating > 5) return 'Please pick a rating from 1 to 5 stars'
    if (title.length < 3 || title.length > 120) return 'Title must be 3-120 characters'
    if (body.length < 20 || body.length > 4000) return 'Review must be 20-4000 characters'
    if (wouldRecommend === null) return 'Please answer "would you recommend?"'
    if (childAgeMonths) {
      const n = Number(childAgeMonths)
      if (!Number.isInteger(n) || n < 0 || n > 72)
        return 'Child age must be between 0 and 72 months'
    }
    if (authorDisplayName && authorDisplayName.length > 60)
      return 'Display name must be 60 characters or fewer'
    return null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setSubmitting(true)
    try {
      await submitReview(urn, {
        rating,
        title,
        body,
        would_recommend: wouldRecommend!,
        child_age_months: childAgeMonths ? Number(childAgeMonths) : null,
        attended_from: attendedFrom || null,
        attended_to: attendedTo || null,
        author_display_name: authorDisplayName || null,
      })
      setSuccess(true)
      setRating(0)
      setTitle('')
      setBody('')
      setWouldRecommend(null)
      setChildAgeMonths('')
      setAttendedFrom('')
      setAttendedTo('')
      setAuthorDisplayName('')
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-4">
        <p className="font-medium text-green-900">Thanks — your review is live</p>
        <p className="text-sm text-green-800 mt-1">
          It will appear in the list shortly. You can submit another review for a different nursery.
        </p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="mt-3 text-sm text-green-700 underline"
        >
          Write another
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-gray-200 rounded-lg p-4 bg-white space-y-4"
      aria-label="Write a review"
    >
      <div>
        <h3 className="font-semibold text-gray-900">Write a review</h3>
        <p className="text-xs text-gray-500 mt-1">
          Reviews are anonymous. We log a hashed IP only to prevent spam.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Your rating</label>
        <div className="flex gap-1 text-3xl" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover(i)}
              onClick={() => setRating(i)}
              aria-label={`${i} star${i > 1 ? 's' : ''}`}
              className={
                i <= (hover || rating) ? 'text-yellow-500' : 'text-gray-300'
              }
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="review-title" className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          id="review-title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={120}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Summary of your experience"
        />
        <p className="text-xs text-gray-400 mt-1">{title.length}/120</p>
      </div>

      <div>
        <label htmlFor="review-body" className="block text-sm font-medium text-gray-700 mb-1">
          Your review
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={4000}
          rows={5}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="What did you and your child think?"
        />
        <p className="text-xs text-gray-400 mt-1">{body.length}/4000 (minimum 20)</p>
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-700 mb-1">
          Would you recommend this nursery?
        </span>
        <div className="flex gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="recommend"
              checked={wouldRecommend === true}
              onChange={() => setWouldRecommend(true)}
            />
            Yes
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="recommend"
              checked={wouldRecommend === false}
              onChange={() => setWouldRecommend(false)}
            />
            No
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="review-age"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Child age (months) — optional
          </label>
          <input
            id="review-age"
            type="number"
            min={0}
            max={72}
            value={childAgeMonths}
            onChange={e => setChildAgeMonths(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="review-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Display name (optional)
          </label>
          <input
            id="review-name"
            type="text"
            value={authorDisplayName}
            onChange={e => setAuthorDisplayName(e.target.value)}
            maxLength={60}
            placeholder="Parent of a 2-year-old"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="review-from"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Attended from (optional)
          </label>
          <input
            id="review-from"
            type="date"
            value={attendedFrom}
            onChange={e => setAttendedFrom(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="review-to"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Attended to (optional)
          </label>
          <input
            id="review-to"
            type="date"
            value={attendedTo}
            onChange={e => setAttendedTo(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-4 py-2 rounded-md text-sm"
      >
        {submitting ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  )
}
