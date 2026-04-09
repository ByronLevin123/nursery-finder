'use client'

import Link from 'next/link'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-8 mb-8 shadow-lg">
          <h1 className="text-4xl font-bold mb-2">Oops</h1>
          <p className="text-lg font-medium text-white/90">Something went wrong</p>
        </div>

        <p className="text-gray-600 mb-8">
          We ran into an unexpected problem. Please try again, or head back to the
          home page.
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
