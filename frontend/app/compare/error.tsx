'use client'

import Link from 'next/link'

export default function CompareError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Could not load comparison
      </h1>
      <p className="text-gray-500 mb-2">
        We were unable to load the nurseries for comparison. This usually means the
        service is temporarily unavailable.
      </p>
      <p className="text-sm text-gray-400 mb-8">
        Your compare list is saved — you can try again in a moment.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={reset}
          className="px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
        >
          Try again
        </button>
        <Link
          href="/search"
          className="px-6 py-3 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition"
        >
          Search nurseries
        </Link>
      </div>
    </div>
  )
}
