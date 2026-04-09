import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-8 mb-8 shadow-lg">
          <h1 className="text-6xl font-bold mb-2">404</h1>
          <p className="text-xl font-medium text-white/90">Page not found</p>
        </div>

        <p className="text-gray-600 mb-8">
          Sorry, we couldn&apos;t find the page you were looking for. It may have
          been moved or no longer exists.
        </p>

        {/* Search bar */}
        <form action="/search" method="get" className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              name="q"
              placeholder="Search by postcode, area, or nursery name..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
            >
              Search
            </button>
          </div>
        </form>

        {/* Popular links */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Popular pages
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="px-4 py-2 rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-indigo-300 hover:bg-indigo-50 transition"
            >
              Home
            </Link>
            <Link
              href="/search"
              className="px-4 py-2 rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-indigo-300 hover:bg-indigo-50 transition"
            >
              Search
            </Link>
            <Link
              href="/quiz"
              className="px-4 py-2 rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-indigo-300 hover:bg-indigo-50 transition"
            >
              Quiz
            </Link>
            <Link
              href="/property-search"
              className="px-4 py-2 rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-indigo-300 hover:bg-indigo-50 transition"
            >
              Find an Area
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
