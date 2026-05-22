'use client'

import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isNetworkError =
    error.message === 'Failed to fetch' ||
    error.message.includes('NetworkError') ||
    error.message.includes('network')

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {isNetworkError ? 'Connection problem' : 'Something went wrong'}
        </h1>

        <p className="text-gray-500 mb-2">
          {isNetworkError
            ? 'We could not reach the server. Please check your internet connection and try again.'
            : 'We ran into an unexpected problem. This is usually temporary.'}
        </p>
        <p className="text-sm text-gray-400 mb-8">
          If this keeps happening, try refreshing the page or come back in a few minutes.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-6 py-3 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition"
          >
            Go to home page
          </Link>
        </div>
      </div>
    </div>
  )
}
