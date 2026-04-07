import { Metadata } from 'next'
import { getNursery } from '@/lib/api'
import { notFound } from 'next/navigation'
import GradeBadge from '@/components/GradeBadge'
import StaleGradeBanner from '@/components/StaleGradeBanner'
import EnforcementBanner from '@/components/EnforcementBanner'
import FeeModal from '@/components/FeeModal'
import ShortlistButton from '@/components/ShortlistButton'
import OglAttribution from '@/components/OglAttribution'
import ReviewSection from '@/components/ReviewSection'
import AiNurserySummary from '@/components/AiNurserySummary'
import AiReviewSynthesis from '@/components/AiReviewSynthesis'
import dynamic from 'next/dynamic'

const SingleNurseryMap = dynamic(() => import('@/components/SingleNurseryMap'), { ssr: false })

export async function generateMetadata({ params }: { params: { urn: string } }): Promise<Metadata> {
  try {
    const nursery = await getNursery(params.urn)
    return {
      title: `${nursery.name} — Ofsted ${nursery.ofsted_overall_grade || 'Rating Pending'} | NurseryFinder`,
      description: `${nursery.name} in ${nursery.town} is rated ${nursery.ofsted_overall_grade || 'not yet rated'} by Ofsted. ${nursery.total_places ? `${nursery.total_places} places available.` : ''}`,
    }
  } catch {
    return { title: 'Nursery not found | NurseryFinder' }
  }
}

export default async function NurseryPage({ params }: { params: { urn: string } }) {
  let nursery
  try {
    nursery = await getNursery(params.urn)
  } catch {
    notFound()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Banners */}
      <EnforcementBanner
        enforcementNotice={nursery.enforcement_notice}
        inspectionReportUrl={nursery.inspection_report_url}
      />
      <StaleGradeBanner
        lastInspectionDate={nursery.last_inspection_date}
        inspectionDateWarning={nursery.inspection_date_warning}
      />

      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{nursery.name}</h1>
          <p className="text-gray-500 mt-1">{nursery.town}{nursery.local_authority ? `, ${nursery.local_authority}` : ''}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <GradeBadge grade={nursery.ofsted_overall_grade} size="lg" />
          <ShortlistButton urn={nursery.urn} />
        </div>
      </div>

      <AiNurserySummary urn={nursery.urn} />

      {/* Details grid */}
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

      {/* Fee section */}
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

      {/* Claim CTA */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-center">
        <p className="text-sm text-gray-600 mb-2">Is this your nursery?</p>
        <a href={`/claim/${nursery.urn}`} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          Claim this listing →
        </a>
      </div>

      {/* Map */}
      {nursery.lat && nursery.lng && (
        <div className="mb-6 rounded-lg overflow-hidden border border-gray-200 h-48">
          <SingleNurseryMap lat={nursery.lat} lng={nursery.lng} name={nursery.name} />
        </div>
      )}

      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ChildCare',
            name: nursery.name,
            address: {
              '@type': 'PostalAddress',
              streetAddress: nursery.address_line1,
              addressLocality: nursery.town,
              postalCode: nursery.postcode,
              addressCountry: 'GB',
            },
            telephone: nursery.phone,
            url: nursery.website,
            ...(nursery.google_rating && {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: nursery.google_rating,
                reviewCount: nursery.google_review_count,
              }
            }),
          }),
        }}
      />

      <AiReviewSynthesis urn={nursery.urn} />
      <ReviewSection urn={nursery.urn} />

      <OglAttribution />
    </div>
  )
}
