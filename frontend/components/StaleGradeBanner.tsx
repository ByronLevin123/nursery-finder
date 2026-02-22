interface Props {
  lastInspectionDate: string | null
  inspectionDateWarning: boolean
}

export default function StaleGradeBanner({ lastInspectionDate, inspectionDateWarning }: Props) {
  if (!inspectionDateWarning) return null

  const formatted = lastInspectionDate
    ? new Date(lastInspectionDate).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : 'unknown'

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
        <div>
          <p className="text-amber-800 font-medium text-sm">
            Inspection data may be out of date
          </p>
          <p className="text-amber-700 text-sm mt-1">
            This nursery was last inspected on {formatted} — over 4 years ago.
            The grade shown may not reflect current quality. We recommend checking the
            full Ofsted report and visiting the nursery before making a decision.
          </p>
        </div>
      </div>
    </div>
  )
}
