import { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { getNursery, getNurseriesInDistrict } from '@/lib/api'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import ClaimNurseryButton from '@/components/ClaimNurseryButton'
import Breadcrumbs from '@/components/Breadcrumbs'
import { nurserySchema, breadcrumbSchema, faqSchema, jsonLdScript } from '@/lib/schema'
import GradeBadge from '@/components/GradeBadge'
import StaleGradeBanner from '@/components/StaleGradeBanner'
import EnforcementBanner from '@/components/EnforcementBanner'
import FeeModal from '@/components/FeeModal'
import ShortlistButton from '@/components/ShortlistButton'
import OglAttribution from '@/components/OglAttribution'
import NearbyPromotions from '@/components/NearbyPromotions'
import AvailabilityBadge from '@/components/AvailabilityBadge'
import CompareButton from '@/components/CompareButton'
import ReviewSection from '@/components/ReviewSection'
import AiNurserySummary from '@/components/AiNurserySummary'
import AiReviewSynthesis from '@/components/AiReviewSynthesis'
import NurseryInsightPanel from '@/components/NurseryInsightPanel'
import dynamic from 'next/dynamic'

const SingleNurseryMap = dynamic(() => import('@/components/SingleNurseryMap'), { ssr: false })
const TravelTimePanel = dynamic(() => import('@/components/TravelTimePanel'), { ssr: false })
const NurseryPricingTab = dynamic(() => import('@/components/NurseryPricingTab'), { ssr: false })
const NurseryAvailabilityTab = dynamic(() => import('@/components/NurseryAvailabilityTab'), { ssr: false })
const BookVisitButton = dynamic(() => import('@/components/BookVisitButton'), { ssr: false })
const TrueCostCalculator = dynamic(() => import('@/components/TrueCostCalculator'), { ssr: false })
const EnquiryModalTrigger = dynamic(() => import('@/components/EnquiryModalTrigger'), { ssr: false })
const ViewTracker = dynamic(() => import('@/components/ViewTracker'), { ssr: false })
const SimilarNurseries = dynamic(() => import('@/components/SimilarNurseries'), { ssr: false })
const NearbySchools = dynamic(() => import('@/components/NearbySchools'), { ssr: false })
const ProgressionPath = dynamic(() => import('@/components/ProgressionPath'), { ssr: false })
const NurseryPlaceholder = dynamic(() => import('@/components/NurseryPlaceholder'), { ssr: false })
const RecentlyViewedTracker = dynamic(() => import('@/components/RecentlyViewedTracker'), { ssr: false })
const ProviderPhotoGallery = dynamic(() => import('@/components/ProviderPhotoGallery'), { ssr: false })
const NurseryQA = dynamic(() => import('@/components/NurseryQA'), { ssr: false })
const VisitChecklistSection = dynamic(() => import('@/components/VisitChecklistSection'), { ssr: false })
const StreetViewPanorama = dynamic(() => import('@/components/StreetViewPanorama'), { ssr: false })
const StickyProfileNav = dynamic(() => import('@/components/StickyProfileNav'), { ssr: false })
const JoinWaitlistButton = dynamic(() => import('@/components/JoinWaitlistButton'), { ssr: false })
const ShareButtons = dynamic(() => import('@/components/ShareButtons'), { ssr: false })
const NewsletterPopup = dynamic(() => import('@/components/NewsletterPopup'), { ssr: false })
const AdUnit = dynamic(() => import('@/components/AdUnit'), { ssr: false })

export async function generateMetadata({ params }: { params: { urn: string } }): Promise<Metadata> {
  try {
    const nursery = await getNursery(params.urn)
    const title = `${nursery.name} — Ofsted ${nursery.ofsted_overall_grade || 'Rating Pending'}`
    const description = `${nursery.name} in ${nursery.town} is rated ${nursery.ofsted_overall_grade || 'not yet rated'} by Ofsted. ${nursery.total_places ? `${nursery.total_places} places available.` : ''}`
    const url = `/nursery/${nursery.urn}`
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
    return { title: 'Nursery not found | NurseryMatch' }
  }
}

function districtFromPostcode(postcode: string | null | undefined): string | null {
  if (!postcode) return null
  const m = postcode.toUpperCase().match(/^([A-Z]{1,2}\d[A-Z\d]?)/)
  return m ? m[1] : null
}

export default async function NurseryPage({ params }: { params: { urn: string } }) {
  let nursery
  try {
    nursery = await getNursery(params.urn)
  } catch {
    notFound()
  }

  if (nursery.provider_type === 'Childminder') {
    redirect(`/childminder/${nursery.urn}`)
  }

  // Read the current user's profile (if signed in) so TravelTimePanel can
  // default the "Home" option to their saved home_postcode.
  let homePostcode: string | undefined
  let currentUserId: string | undefined
  try {
    const supabase = createServerComponentClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user) {
      currentUserId = session.user.id
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('home_postcode')
        .eq('id', session.user.id)
        .maybeSingle()
      if (profile?.home_postcode) homePostcode = profile.home_postcode
    }
  } catch {
    // non-fatal — just means no personalised defaults
  }

  const district = districtFromPostcode(nursery.postcode)
  let relatedNurseries: any[] = []
  if (district) {
    try {
      const data = await getNurseriesInDistrict(district)
      relatedNurseries = (data?.nurseries || [])
        .filter((n: any) => n.urn !== nursery.urn)
        .slice(0, 5)
    } catch {
      relatedNurseries = []
    }
  }

  const crumbs = [
    { name: 'Home', href: '/' },
    ...(district
      ? [{ name: `Nurseries in ${district}`, href: `/nurseries-in/${district.toLowerCase()}` }]
      : []),
    { name: nursery.name },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />
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
      <div className="mb-4">
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
        {nursery.claimed_by_user_id && (
          <span className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-medium">
            Verified provider
          </span>
        )}
      </div>

      {/* Key info badges */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {nursery.total_places && (
          <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">{nursery.total_places} places</span>
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

      {/* Hero photo gallery */}
      <div className="mb-6">
        <ProviderPhotoGallery urn={nursery.urn} nurseryName={nursery.name} />
        {nursery.photos && nursery.photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {nursery.photos.slice(0, 6).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={`${nursery.name} photo ${i + 1}`} className="w-full h-40 object-cover rounded-lg border border-gray-200" />
            ))}
          </div>
        )}
      </div>

      {/* Action CTAs — visible without scrolling */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <BookVisitButton urn={nursery.urn} nurseryId={nursery.id} />
        <EnquiryModalTrigger urn={nursery.urn} nurseryName={nursery.name} nurseryId={nursery.id} />
        <CompareButton urn={nursery.urn} />
        <JoinWaitlistButton
          nurseryId={nursery.id}
          nurseryUrn={nursery.urn}
          nurseryName={nursery.name}
          spotsAvailable={nursery.spots_available}
          hasWaitlist={nursery.has_waitlist}
        />
      </div>
      <ShareButtons
        url={`https://www.nurserymatch.com/nursery/${nursery.urn}`}
        title={nursery.name}
      />

      <StickyProfileNav />

      {/* Details grid */}
      <div id="overview" className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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
      <div id="fees" className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="font-medium text-blue-900 mb-1">💷 Fees</p>
        {nursery.fee_avg_monthly && nursery.fee_report_count >= 3 ? (
          <p className="text-sm text-blue-800">
            Average: <strong>£{nursery.fee_avg_monthly}/month</strong> — based on {nursery.fee_report_count} parent reports
          </p>
        ) : (
          <p className="text-sm text-blue-700">No fee data yet for this nursery.</p>
        )}
        <FeeModal nurseryId={nursery.urn} />
      </div>

      {/* True Cost Calculator */}
      <TrueCostCalculator
        feeAvgMonthly={nursery.fee_avg_monthly}
        feeReportCount={nursery.fee_report_count}
        placesFunded2yr={nursery.places_funded_2yr}
        placesFunded3_4yr={nursery.places_funded_3_4yr}
        nurseryName={nursery.name}
      />

      {/* Availability */}
      <NurseryAvailabilityTab urn={nursery.urn} />

      {/* Provider-supplied content */}
      {nursery.description && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-gray-900 mb-2">About this nursery</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{nursery.description}</p>
        </div>
      )}


      {/* More nurseries in this district — internal linking for SEO */}
      {relatedNurseries.length > 0 && district && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            More nurseries in {district}
          </h2>
          <ul className="space-y-2">
            {relatedNurseries.map((n) => (
              <li key={n.urn}>
                <Link
                  href={`/nursery/${n.urn}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {n.name}
                </Link>
                {n.ofsted_overall_grade && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({n.ofsted_overall_grade})
                  </span>
                )}
              </li>
            ))}
          </ul>
          <Link
            href={`/nurseries-in/${district.toLowerCase()}`}
            className="inline-block mt-3 text-sm text-indigo-600 hover:underline"
          >
            View all nurseries in {district} →
          </Link>
        </section>
      )}

      {/* Nearby Outstanding nurseries — falls back to district list */}
      {relatedNurseries.some((n) => n.ofsted_overall_grade === 'Outstanding') && (
        <section className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h2 className="font-semibold text-amber-900 mb-2">Nearby Outstanding nurseries</h2>
          <ul className="space-y-1">
            {relatedNurseries
              .filter((n) => n.ofsted_overall_grade === 'Outstanding')
              .slice(0, 3)
              .map((n) => (
                <li key={n.urn}>
                  <Link
                    href={`/nursery/${n.urn}`}
                    className="text-sm text-amber-900 hover:underline"
                  >
                    {n.name}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(nurserySchema(nursery, district ? { district } : undefined)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema(crumbs.map((c) => ({ name: c.name, url: c.href || `/nursery/${nursery.urn}` })))) }}
      />
      {(() => {
        const faqs: { question: string; answer: string }[] = []
        if (nursery.ofsted_overall_grade) {
          faqs.push({ question: `What is the Ofsted rating of ${nursery.name}?`, answer: `${nursery.name} has an Ofsted rating of ${nursery.ofsted_overall_grade}.` })
        }
        if (nursery.town) {
          faqs.push({ question: `Where is ${nursery.name} located?`, answer: `${nursery.name} is located in ${nursery.town}${nursery.postcode ? `, ${nursery.postcode}` : ''}.` })
        }
        if (nursery.total_places) {
          faqs.push({ question: `How many places does ${nursery.name} have?`, answer: `${nursery.name} has ${nursery.total_places} registered places.` })
        }
        if (faqs.length === 0) return null
        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdScript(faqSchema(faqs)) }}
          />
        )
      })()}

      <div id="reviews">
        <AiReviewSynthesis urn={nursery.urn} />
        <ReviewSection urn={nursery.urn} />
      </div>

      <div id="qa">
        <NurseryQA urn={nursery.urn} isProvider={!!currentUserId && nursery.claimed_by_user_id === currentUserId} />
      </div>

      {/* More about this nursery — collapsible secondary info */}
      <details className="border border-gray-200 rounded-xl mb-6">
        <summary className="p-4 cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
          More about this nursery
          <svg className="w-5 h-5 text-gray-400 details-chevron transition-transform" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </summary>
        <div className="px-4 pb-4 space-y-4">
          <AiNurserySummary urn={nursery.urn} />

          <NurseryInsightPanel
            qualityScore={nursery.quality_score}
            costScore={nursery.cost_score}
            availabilityScore={nursery.availability_score}
            staffScore={nursery.staff_score}
            sentimentScore={nursery.sentiment_score}
          />

          {(nursery.website_url || nursery.contact_email || nursery.contact_phone) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase font-medium mb-2">Provider contact</p>
              {nursery.website_url && (
                <p className="text-sm">
                  <a href={nursery.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {nursery.website_url}
                  </a>
                </p>
              )}
              {nursery.contact_email && (
                <p className="text-sm">
                  <a href={`mailto:${nursery.contact_email}`} className="text-blue-600 hover:underline">{nursery.contact_email}</a>
                </p>
              )}
              {nursery.contact_phone && (
                <p className="text-sm">
                  <a href={`tel:${nursery.contact_phone.replace(/\s/g, '')}`} className="text-blue-600 hover:underline">{nursery.contact_phone}</a>
                </p>
              )}
            </div>
          )}

          <VisitChecklistSection nurseryName={nursery.name} nurseryUrn={nursery.urn} />

          {nursery.lat && nursery.lng && (
            <StreetViewPanorama lat={nursery.lat} lng={nursery.lng} name={nursery.name} />
          )}

          {nursery.lat && nursery.lng && (
            <TravelTimePanel
              nurseryLat={nursery.lat}
              nurseryLng={nursery.lng}
              nurseryUrn={nursery.urn}
              homePostcode={homePostcode}
            />
          )}

          {nursery.lat && nursery.lng && (
            <>
              <NearbySchools lat={nursery.lat} lng={nursery.lng} />
              <ProgressionPath urn={nursery.urn} />
            </>
          )}

          {nursery.lat && nursery.lng && (
            <NearbyPromotions lat={nursery.lat} lng={nursery.lng} />
          )}
        </div>
      </details>

      {/* Photo placeholder when no provider photos */}
      {(!nursery.photos || nursery.photos.length === 0) && (
        <div className="mb-6">
          <NurseryPlaceholder name={nursery.name} lat={nursery.lat} lng={nursery.lng} ofstedGrade={nursery.ofsted_overall_grade} />
        </div>
      )}

      <AdUnit slot="nursery-profile" format="horizontal" className="my-6 rounded-lg overflow-hidden" />

      {/* Similar nurseries */}
      <SimilarNurseries urn={nursery.urn} />

      <ClaimNurseryButton
        urn={nursery.urn}
        nurseryName={nursery.name}
        alreadyClaimed={!!nursery.claimed_by_user_id}
        claimedByCurrentUser={
          !!nursery.claimed_by_user_id &&
          !!currentUserId &&
          nursery.claimed_by_user_id === currentUserId
        }
      />

      <ViewTracker urn={nursery.urn} />
      <RecentlyViewedTracker urn={nursery.urn} name={nursery.name} grade={nursery.ofsted_overall_grade} town={nursery.town} />
      <NewsletterPopup />
      <OglAttribution />
    </div>
  )
}
