interface Props {
  enforcementNotice: boolean
  inspectionReportUrl?: string | null
}

export default function EnforcementBanner({ enforcementNotice, inspectionReportUrl }: Props) {
  if (!enforcementNotice) return null

  return (
    <div className="bg-red-50 border border-red-300 rounded-md p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-red-500 text-lg flex-shrink-0">🚨</span>
        <div>
          <p className="text-red-800 font-semibold text-sm">
            Ofsted enforcement notice issued
          </p>
          <p className="text-red-700 text-sm mt-1">
            Ofsted has issued an enforcement notice to this provider.
            This may indicate a serious concern about quality or safety.
            We strongly recommend reviewing the full Ofsted report and
            contacting Ofsted directly before considering this nursery.
          </p>
          {inspectionReportUrl && (
            <a
              href={inspectionReportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sm text-red-800 font-medium underline"
            >
              View full Ofsted report →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
