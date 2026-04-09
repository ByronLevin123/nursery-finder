export default function SearchLoading() {
  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-64px)] animate-pulse">
      {/* Left panel skeleton */}
      <div className="w-full lg:w-1/3 border-r border-gray-200 bg-white p-4 space-y-4">
        {/* Search bar skeleton */}
        <div className="flex gap-2">
          <div className="flex-1 h-10 bg-gray-200 rounded-lg" />
          <div className="w-20 h-10 bg-gray-200 rounded-lg" />
        </div>

        {/* Filter skeletons */}
        <div className="space-y-3">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-12 h-8 bg-gray-200 rounded-full" />
            ))}
          </div>
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="h-10 bg-gray-200 rounded-lg" />
        </div>

        {/* Result card skeletons */}
        <div className="space-y-3 pt-4 border-t border-gray-200">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 p-4 space-y-2"
            >
              <div className="h-5 w-3/4 bg-gray-200 rounded" />
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="flex gap-2">
                <div className="h-6 w-20 bg-gray-200 rounded-full" />
                <div className="h-6 w-16 bg-gray-200 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel: map skeleton */}
      <div className="w-full lg:w-2/3 h-[400px] lg:h-auto bg-gray-100" />
    </div>
  )
}
