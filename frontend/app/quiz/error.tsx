'use client'

import Link from 'next/link'

export default function QuizError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Quiz unavailable</h1>
      <p className="text-gray-500 mb-8">
        We could not load the nursery quiz right now. Please try again in a moment.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={reset} className="px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition">
          Try again
        </button>
        <Link href="/search" className="px-6 py-3 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition">
          Search instead
        </Link>
      </div>
    </div>
  )
}
