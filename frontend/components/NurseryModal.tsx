'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { getNursery, Nursery, postcodeDistrict } from '@/lib/api'
import AreaSummaryCard from './AreaSummaryCard'
import GradeBadge from './GradeBadge'
import StaleGradeBanner from './StaleGradeBanner'
import EnforcementBanner from './EnforcementBanner'
import FeeModal from './FeeModal'
import ShortlistButton from './ShortlistButton'
import OglAttribution from './OglAttribution'
import ReviewStars from './ReviewStars'

const SingleNurseryMap = dynamic(() => import('./SingleNurseryMap'), { ssr: false })

interface Props {
  urn: string | null
  onClose: () => void
}

export default function NurseryModal({ urn, onClose }: Props) {
  const [nursery, setNursery] = useState<Nursery | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!urn) {
      setNursery(null)
      return
    }
    setLoading(true)
    setError(null)
    getNursery(urn)
      .then(setNursery)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [urn])

  useEffect(() => {
    if (!urn) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [urn, onClose])

  if (!urn) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[2000] flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full my-8 relative shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600"
        >
          ✕
        </button>

        <div className="p-6">
          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {nursery && (
            <>
              <EnforcementBanner
                enforcementNotice={nursery.enforcement_notice}
                inspectionReportUrl={nursery.inspection_report_url}
              />
              <StaleGradeBanner
                lastInspectionDate={nursery.last_inspection_date}
                inspectionDateWarning={nursery.inspection_date_warning}
              />

              <div className="flex justify-between items-start gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{nursery.name}</h2>
                  <p className="text-gray-500 mt-1">
                    {nursery.town}{nursery.local_authority ? `, ${nursery.local_authority}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <GradeBadge grade={nursery.ofsted_overall_grade} size="lg" />
                  <ShortlistButton urn={nursery.urn} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {nursery.address_line1 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase font-medium mb-1">Address</p>
                    <p className="text-sm">{nursery.address_line1}</p>
                    {nursery.address_line2 && <p className="text-sm">{nursery.address_line2}</p>}
                    <p className="text-sm">{nursery.town}</p>
                    <p className="text-sm font-medium">{nursery.postcode}</p>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase font-medium mb-1">Places</p>
                  {nursery.total_places && <p className="text-sm">Total: <strong>{nursery.total_places}</strong></p>}
                  {nursery.places_funded_2yr && nursery.places_funded_2yr > 0 && (
                    <p className="text-sm text-green-700">✓ {nursery.places_funded_2yr} funded 2-year places</p>
                  )}
                  {nursery.places_funded_3_4yr && nursery.places_funded_3_4yr > 0 && (
                    <p className="text-sm text-green-700">✓ {nursery.places_funded_3_4yr} funded 3-4yr places</p>
                  )}
                </div>

                {(nursery.phone || nursery.email) && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase font-medium mb-1">Contact</p>
                    {nursery.phone && <p className="text-sm">📞 {nursery.phone}</p>}
                    {nursery.email && <p className="text-sm">✉️ {nursery.email}</p>}
                    {nursery.website && (
                      <a href={nursery.website} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline">🌐 Website</a>
                    )}
                  </div>
                )}

                {nursery.review_count != null && nursery.review_count > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase font-medium mb-1">Parent reviews</p>
                    <div className="flex items-center gap-2">
                      <ReviewStars rating={Number(nursery.review_avg_rating ?? 0)} size="sm" />
                      <span className="text-sm">
                        {Number(nursery.review_avg_rating ?? 0).toFixed(1)} ({nursery.review_count})
                      </span>
                    </div>
                    <a
                      href={`/nursery/${nursery.urn}#reviews`}
                      className="text-xs text-blue-600 hover:underline mt-1 block"
                    >
                      See full reviews →
                    </a>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase font-medium mb-1">Ofsted Inspection</p>
                  {nursery.last_inspection_date && (
                    <p className="text-sm">
                      Last inspected: {new Date(nursery.last_inspection_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                  {nursery.inspection_report_url && (
                    <a href={nursery.inspection_report_url} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline mt-1 block">
                      View full Ofsted report →
                    </a>
                  )}
                </div>
              </div>

              <AreaSummaryCard district={postcodeDistrict(nursery.postcode)} />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="font-medium text-blue-900 mb-1">💷 Fees</p>
                {nursery.fee_avg_monthly && nursery.fee_report_count >= 3 ? (
                  <p className="text-sm text-blue-800">
                    Average: <strong>£{nursery.fee_avg_monthly}/month</strong> — based on {nursery.fee_report_count} parent reports
                  </p>
                ) : (
                  <p className="text-sm text-blue-700">No fee data yet for this nursery.</p>
                )}
                <FeeModal nurseryId={nursery.id} />
              </div>

              {nursery.lat && nursery.lng && (
                <div className="mb-6 rounded-lg overflow-hidden border border-gray-200 h-48">
                  <SingleNurseryMap lat={nursery.lat} lng={nursery.lng} name={nursery.name} />
                </div>
              )}

              <a
                href={`/nursery/${nursery.urn}`}
                className="text-sm text-blue-600 hover:underline block text-center mb-4"
              >
                Open full page →
              </a>

              <OglAttribution />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
