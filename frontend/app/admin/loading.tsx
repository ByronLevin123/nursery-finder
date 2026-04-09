export default function AdminLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="h-8 w-48 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-72 bg-gray-200 rounded" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-6 space-y-3"
          >
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-8 w-16 bg-gray-200 rounded" />
            <div className="h-3 w-32 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* Table placeholder */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="h-5 w-32 bg-gray-200 rounded" />
        </div>
        <div className="divide-y divide-gray-200">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="h-4 w-1/4 bg-gray-200 rounded" />
              <div className="h-4 w-1/4 bg-gray-200 rounded" />
              <div className="h-4 w-1/6 bg-gray-200 rounded" />
              <div className="h-4 w-1/6 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
