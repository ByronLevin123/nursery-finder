export default function NurseryProfileLoading() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="h-4 w-48 bg-white/20 rounded" />
          <div className="h-8 w-2/3 bg-white/20 rounded" />
          <div className="h-5 w-1/3 bg-white/20 rounded" />
          <div className="flex gap-3 pt-2">
            <div className="h-8 w-28 bg-white/20 rounded-full" />
            <div className="h-8 w-24 bg-white/20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="md:col-span-2 space-y-6">
            {/* Detail grid */}
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-200 p-4 space-y-2"
                >
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                  <div className="h-6 w-32 bg-gray-200 rounded" />
                </div>
              ))}
            </div>

            {/* Description block */}
            <div className="space-y-2">
              <div className="h-5 w-40 bg-gray-200 rounded" />
              <div className="h-4 w-full bg-gray-200 rounded" />
              <div className="h-4 w-full bg-gray-200 rounded" />
              <div className="h-4 w-3/4 bg-gray-200 rounded" />
            </div>

            {/* Reviews placeholder */}
            <div className="space-y-3">
              <div className="h-5 w-32 bg-gray-200 rounded" />
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-200 p-4 space-y-2"
                >
                  <div className="h-4 w-1/4 bg-gray-200 rounded" />
                  <div className="h-4 w-full bg-gray-200 rounded" />
                  <div className="h-4 w-2/3 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Map placeholder */}
            <div className="h-48 bg-gray-200 rounded-xl" />

            {/* Info cards */}
            {[1, 2].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 p-4 space-y-2"
              >
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-5 w-full bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
