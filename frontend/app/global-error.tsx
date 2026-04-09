'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
          <div className="max-w-md w-full text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-8">
              An unexpected error occurred. Please reload the page to try again.
            </p>
            <button
              onClick={reset}
              className="px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
