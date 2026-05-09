'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => typeof window !== 'undefined' && window.print()}
      className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700"
    >
      Save as PDF
    </button>
  )
}
