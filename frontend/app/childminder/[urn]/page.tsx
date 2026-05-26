import { Metadata } from 'next'
import { getNursery, getNurseriesInDistrict } from '@/lib/api'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
import GradeBadge from '@/components/GradeBadge'
import StaleGradeBanner from '@/components/StaleGradeBanner'
import EnforcementBanner from '@/components/EnforcementBanner'
import FeeModal from '@/components/FeeModal'
import ShortlistButton from '@/components/ShortlistButton'
import OglAttribution from '@/components/OglAttribution'
import AvailabilityBadge from '@/components/AvailabilityBadge'
import CompareButton from '@/components/CompareButton'
import ReviewSection from '@/components/ReviewSection'
import dynamic from 'next/dynamic'

const SingleNurseryMap = dynamic(() => import('@/components/SingleNurseryMap'), { ssr: false })
const BookVisitButton = dynamic(() => import('@/components/BookVisitButton'), { ssr: false })
const EnquiryModalTrigger = dynamic(() => import('@/components/EnquiryModalTrigger'), { ssr: false })
const ViewTracker = dynamic(() => import('@/components/ViewTracker'), { ssr: false })
const SimilarNurseries = dynamic(() => import('@/components/SimilarNurseries'), { ssr: false })
const NurseryAvailabilityTab = dynamic(() => import('@/components/NurseryAvailabilityTab'), { ssr: false })
const TrueCostCalculator = dynamic(() => import('@/components/TrueCostCalculator'), { ssr: false })
const NurseryQA = dynamic(() => import('@/components/NurseryQA'), { ssr: false })
const ShareButtons = dynamic(() => import('@/components/ShareButtons'), { ssr: false })
const AiReviewSynthesis = dynamic(() => import('@/components/AiReviewSynthesis'), { ssr: false })

function districtFromPostcode(postcode: string | null | undefined): string | null {
  if (!postcode) return null
  const m = postcode.toUpperCase().match(/^([A-Z]{1,2}\d[A-Z\d]?)/)
  return m ? m[1] : null
}

export async function generateMetadata({ params }: { params: { urn: string } }): Promise<Metadata> {
  try {
    const nursery = await getNursery(params.urn)
    const title = `${nursery.name} — Ofsted ${nursery.ofsted_overall_grade || 'Rating Pending'} Childminder`
    const description = `${nursery.name} is an Ofsted-rated childminder in ${nursery.town}. Rated ${nursery.ofsted_overall_grade || 'not yet rated'}. ${nursery.total_places ? `${nursery.total_places} registered places.` : ''}`
    const url = `/childminder/${nursery.urn}`
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        siteName: 'NurseryMatch',
        type: 'website',
        locale: 'en_GB',
        images: [{ url: '/og-default.png', width: 1200, height: 630, alt: nursery.name }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: ['/og-default.png'],
      },
    }
  } catch {
    return { title: 'Childminder not found | NurseryMatch' }
  }
}

export default async function ChildminderPage({ params }: { params: { urn: string } }) {
  let nursery
  try {
    nursery = await getNursery(params.urn)
  } catch {
    notFound()
  }

  const district = districtFromPostcode(nursery.postcode)

  const crumbs = [
    { name: 'Home', href: '/' },
    ...(district
      ? [{ name: `Childminders in ${district}`, href: `/search?provider_type=Childminder&q=${district}` }]
      : []),
    { name: nursery.name },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />

      {/* Compliance banners */}
      <EnforcementBanner
        enforcementNotice={nursery.enforcement_notice}
        inspectionReportUrl={nursery.inspection_report_url}
      />
      <StaleGradeBanner
        lastInspectionDate={nursery.last_inspection_date}
        inspectionDateWarning={nursery.inspection_date_warning}
      />

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full font-medium">
            Childminder
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{nursery.name}</h1>
        <p className="text-gray-500 mt-1">{nursery.town}{nursery.local_authority ? `, ${nursery.local_authority}` : ''}</p>
      </div>

      {/* Rating row */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <GradeBadge grade={nursery.ofsted_overall_grade} size="lg" />
        {(nursery as any).google_rating && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1">
            <span className="text-yellow-500">&#9733;</span>
            {(nursery as any).google_rating} Google
            {(nursery as any).google_review_count ? ` (${(nursery as any).google_review_count})` : ''}
          </span>
        )}
        {(nursery as any).review_avg_rating && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1">
            <span className="text-blue-500">&#9733;</span>
            {Number((nursery as any).review_avg_rating).toFixed(1)} Parents
          </span>
        )}
        <AvailabilityBadge nursery={nursery} />
        <ShortlistButton urn={nursery.urn} />
      </div>

      {/* Key info badges */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {nursery.total_places && (
          <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">{nursery.total_places} registered places</span>
        )}
        {nursery.places_funded_2yr && nursery.places_funded_2yr > 0 && (
          <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">2yr funded</span>
        )}
        {nursery.places_funded_3_4yr && nursery.places_funded_3_4yr > 0 && (
          <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">3-4yr funded</span>
        )}
        {nursery.fee_avg_monthly && nursery.fee_report_count >= 3 && (
          <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">~&pound;{nursery.fee_avg_monthly}/mo</span>
        )}
      </div>

      {/* Action CTAs */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <BookVisitButton urn={nursery.urn} nurseryId={nursery.id} />
        <EnquiryModalTrigger urn={nursery.urn} nurseryName={nursery.name} nurseryId={nursery.id} />
        <CompareButton urn={nursery.urn} />
      </div>
      <ShareButtons
        url={`https://www.nurserymatch.com/childminder/${nursery.urn}`}
        title={nursery.name}
      />

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
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Registered Places</p>
          {nursery.total_places && <p className="text-sm">Total: <strong>{nursery.total_places}</strong></p>}
          {nursery.places_funded_2yr && nursery.places_funded_2yr > 0 && (
            <p className="text-sm text-green-700">&#10003; {nursery.places_funded_2yr} funded 2-year places</p>
          )}
          {nursery.places_funded_3_4yr && nursery.places_funded_3_4yr > 0 && (
            <p className="text-sm text-green-700">&#10003; {nursery.places_funded_3_4yr} funded 3-4yr places</p>
          )}
        </div>

        {(nursery.phone || nursery.email) && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase font-medium mb-1">Contact</p>
            {nursery.phone && <p className="text-sm">{nursery.phone}</p>}
            {nursery.email && <p className="text-sm">{nursery.email}</p>}
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
              View full Ofsted report &rarr;
            </a>
          )}
        </div>
      </div>

      {/* Fee section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="font-medium text-blue-900 mb-1">Fees</p>
        {nursery.fee_avg_monthly && nursery.fee_report_count >= 3 ? (
          <p className="text-sm text-blue-800">
            Average: <strong>&pound;{nursery.fee_avg_monthly}/month</strong> — based on {nursery.fee_report_count} parent reports
          </p>
        ) : (
          <p className="text-sm text-blue-700">No fee data yet for this childminder.</p>
        )}
        <FeeModal nurseryId={nursery.urn} />
      </div>

      <TrueCostCalculator
        feeAvgMonthly={nursery.fee_avg_monthly}
        feeReportCount={nursery.fee_report_count}
        placesFunded2yr={nursery.places_funded_2yr}
        placesFunded3_4yr={nursery.places_funded_3_4yr}
        nurseryName={nursery.name}
      />

      <NurseryAvailabilityTab urn={nursery.urn} />

      {nursery.description && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-gray-900 mb-2">About this childminder</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{nursery.description}</p>
        </div>
      )}

      {/* Map */}
      {nursery.lat && nursery.lng && (
        <div className="mb-6">
          <h2 className="font-semibold text-gray-800 mb-2">Location</h2>
          <div className="h-64 rounded-lg overflow-hidden border border-gray-200">
            <SingleNurseryMap lat={nursery.lat} lng={nursery.lng} name={nursery.name} />
          </div>
        </div>
      )}

      <div id="reviews">
        <AiReviewSynthesis urn={nursery.urn} />
        <ReviewSection urn={nursery.urn} />
      </div>

      <NurseryQA urn={nursery.urn} isProvider={false} />

      <SimilarNurseries urn={nursery.urn} />

      <ViewTracker urn={nursery.urn} />

      <OglAttribution />
    </div>
  )
}
