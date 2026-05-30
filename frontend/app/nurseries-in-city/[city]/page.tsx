import { Metadata } from 'next'
import { API_URL, Nursery } from '@/lib/api'
import NurseryCard from '@/components/NurseryCard'
import OglAttribution from '@/components/OglAttribution'
import Breadcrumbs from '@/components/Breadcrumbs'
import AreaSummaryCard from '@/components/AreaSummaryCard'
import DistrictSchools from '@/components/DistrictSchools'
import Link from 'next/link'
import { breadcrumbSchema, faqSchema, jsonLdScript } from '@/lib/schema'

// ---------------------------------------------------------------------------
// Static city data — top 20 UK cities with centre coordinates
// ---------------------------------------------------------------------------

export interface CityData {
  name: string
  slug: string
  lat: number
  lng: number
  /** Postcode districts that fall within (or near) this city — used for
   *  internal links to district-level pages. */
  districts: string[]
}

const CITIES: CityData[] = [
  { name: 'London',      slug: 'london',      lat: 51.5074, lng: -0.1278, districts: ['SW1', 'SW11', 'SE1', 'E1', 'N1', 'NW1', 'W1', 'EC1', 'WC1', 'N16', 'E8', 'NW3'] },
  { name: 'Birmingham',  slug: 'birmingham',  lat: 52.4862, lng: -1.8904, districts: ['B1', 'B2', 'B3', 'B5', 'B15', 'B16', 'B17', 'B29'] },
  { name: 'Manchester',  slug: 'manchester',  lat: 53.4808, lng: -2.2426, districts: ['M1', 'M2', 'M3', 'M4', 'M14', 'M20', 'M21'] },
  { name: 'Leeds',       slug: 'leeds',       lat: 53.8008, lng: -1.5491, districts: ['LS1', 'LS2', 'LS6', 'LS7', 'LS8', 'LS11'] },
  { name: 'Glasgow',     slug: 'glasgow',     lat: 55.8642, lng: -4.2518, districts: ['G1', 'G2', 'G3', 'G12', 'G20', 'G41'] },
  { name: 'Liverpool',   slug: 'liverpool',   lat: 53.4084, lng: -2.9916, districts: ['L1', 'L2', 'L3', 'L8', 'L15', 'L17', 'L18'] },
  { name: 'Bristol',     slug: 'bristol',     lat: 51.4545, lng: -2.5879, districts: ['BS1', 'BS2', 'BS3', 'BS6', 'BS7', 'BS8'] },
  { name: 'Sheffield',   slug: 'sheffield',   lat: 53.3811, lng: -1.4701, districts: ['S1', 'S2', 'S3', 'S7', 'S10', 'S11'] },
  { name: 'Edinburgh',   slug: 'edinburgh',   lat: 55.9533, lng: -3.1883, districts: ['EH1', 'EH2', 'EH3', 'EH9', 'EH10', 'EH11'] },
  { name: 'Cardiff',     slug: 'cardiff',     lat: 51.4816, lng: -3.1791, districts: ['CF10', 'CF11', 'CF14', 'CF24'] },
  { name: 'Nottingham',  slug: 'nottingham',  lat: 52.9548, lng: -1.1581, districts: ['NG1', 'NG2', 'NG3', 'NG5', 'NG7', 'NG9'] },
  { name: 'Newcastle',   slug: 'newcastle',   lat: 54.9783, lng: -1.6178, districts: ['NE1', 'NE2', 'NE3', 'NE4', 'NE6'] },
  { name: 'Leicester',   slug: 'leicester',   lat: 52.6369, lng: -1.1398, districts: ['LE1', 'LE2', 'LE3', 'LE4', 'LE5'] },
  { name: 'Southampton', slug: 'southampton', lat: 50.9097, lng: -1.4044, districts: ['SO14', 'SO15', 'SO16', 'SO17', 'SO18'] },
  { name: 'Brighton',    slug: 'brighton',    lat: 50.8225, lng: -0.1372, districts: ['BN1', 'BN2', 'BN3'] },
  { name: 'Cambridge',   slug: 'cambridge',   lat: 52.2053, lng:  0.1218, districts: ['CB1', 'CB2', 'CB3', 'CB4'] },
  { name: 'Oxford',      slug: 'oxford',      lat: 51.7520, lng: -1.2577, districts: ['OX1', 'OX2', 'OX3', 'OX4'] },
  { name: 'York',        slug: 'york',        lat: 53.9591, lng: -1.0815, districts: ['YO1', 'YO10', 'YO23', 'YO24', 'YO31'] },
  { name: 'Bath',        slug: 'bath',        lat: 51.3811, lng: -2.3590, districts: ['BA1', 'BA2'] },
  { name: 'Reading',     slug: 'reading',     lat: 51.4543, lng: -0.9781, districts: ['RG1', 'RG2', 'RG4', 'RG6', 'RG30'] },
]

const CITY_MAP = new Map(CITIES.map((c) => [c.slug, c]))

/** All valid city slugs for static generation. */
export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }))
}

// ---------------------------------------------------------------------------
// Data fetching helpers (server-side, direct fetch against backend)
// ---------------------------------------------------------------------------

interface SmartSearchResult {
  data: Nursery[]
  meta: {
    total: number
    search_lat: number
    search_lng: number
    mode?: string
    did_you_mean?: string
    query?: string
  }
}

async function fetchCityNurseries(city: CityData): Promise<SmartSearchResult> {
  const res = await fetch(`${API_URL}/api/v1/nurseries/smart-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: city.name, radius_km: 10 }),
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`Smart search failed for ${city.name}: ${res.status}`)
  return res.json()
}

function computeStats(nurseries: Nursery[]) {
  let outstanding = 0
  let good = 0
  for (const n of nurseries) {
    const g = (n.ofsted_overall_grade || '').toLowerCase()
    if (g === 'outstanding') outstanding++
    else if (g === 'good') good++
  }
  return { total: nurseries.length, outstanding, good }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCityName(slug: string): string {
  const city = CITY_MAP.get(slug)
  if (city) return city.name
  return decodeURIComponent(slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

interface Props {
  params: { city: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cityName = formatCityName(params.city)
  const city = CITY_MAP.get(params.city)
  if (!city) {
    return { title: `Nurseries in ${cityName} | NurseryMatch` }
  }

  try {
    const result = await fetchCityNurseries(city)
    const count = result.meta.total || result.data.length
    const title = `Best Nurseries in ${cityName} 2026 — Compare ${count}+ Ofsted-Rated`
    const description = `Compare ${count} Ofsted-rated nurseries in ${cityName}. See grades, funded places, parent reviews and area scores. Find the best nursery for your child in ${cityName}.`
    const url = `/nurseries-in-city/${params.city}`
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
        images: [{ url: '/og-default.png', width: 1200, height: 630, alt: `Nurseries in ${cityName}` }],
      },
      twitter: { card: 'summary_large_image', title, description, images: ['/og-default.png'] },
    }
  } catch {
    return { title: `Best Nurseries in ${cityName} 2026 | NurseryMatch` }
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CityPage({ params }: Props) {
  const city = CITY_MAP.get(params.city)
  if (!city) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">City not found</h1>
        <p className="text-gray-500">We don&apos;t have a landing page for this city yet.</p>
        <Link href="/search" className="text-blue-600 hover:underline mt-4 inline-block">
          Search by postcode instead
        </Link>
      </div>
    )
  }

  let nurseries: Nursery[]
  let totalCount: number

  try {
    const result = await fetchCityNurseries(city)
    nurseries = result.data
    totalCount = result.meta.total || nurseries.length
  } catch {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Nurseries in {city.name}</h1>
        <p className="text-gray-500 mb-4">
          We couldn&apos;t load nursery data for {city.name} right now. Please try again shortly.
        </p>
        <Link href="/search" className="text-blue-600 hover:underline">
          Search by postcode
        </Link>
      </div>
    )
  }

  const stats = computeStats(nurseries)
  const outstandingGoodPct =
    stats.total > 0 ? Math.round(((stats.outstanding + stats.good) / stats.total) * 100) : 0

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Cities', href: '/nurseries-in-city' },
    { name: `Nurseries in ${city.name}` },
  ]

  const faqs = [
    {
      question: `How many nurseries are in ${city.name}?`,
      answer: `We found ${totalCount} Ofsted-registered nurseries within 10km of ${city.name} centre, of which ${stats.outstanding} are rated Outstanding and ${stats.good} are rated Good.`,
    },
    {
      question: `What percentage of nurseries in ${city.name} are Outstanding or Good?`,
      answer: `${outstandingGoodPct}% of nurseries near ${city.name} centre are rated Outstanding or Good by Ofsted.`,
    },
    {
      question: `How do I find the best nursery in ${city.name}?`,
      answer: `This page lists nurseries near ${city.name} centre sorted by Ofsted grade. You can also explore specific districts within ${city.name} for a more localised view. Click any nursery to see its full profile including inspection details, funded places, and parent reviews.`,
    },
    {
      question: `Are there funded nursery places in ${city.name}?`,
      answer: `Yes — many nurseries in ${city.name} offer 15 or 30 hours of government-funded childcare for eligible 2, 3 and 4-year-olds. Each nursery profile shows the number of funded places available.`,
    },
  ]

  // Use first district for area summary card
  const primaryDistrict = city.districts[0] || null

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />

      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Nurseries in {city.name}
        </h1>
        <p className="text-lg text-gray-600">
          {totalCount} Ofsted-rated nurseries within 10km of {city.name} centre
          — {stats.outstanding} Outstanding, {stats.good} Good
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total nurseries', value: totalCount },
          { label: 'Outstanding', value: stats.outstanding },
          { label: 'Good', value: stats.good },
          { label: '% Outstanding/Good', value: `${outstandingGoodPct}%` },
        ].map((s) => (
          <div key={s.label} className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Area summary card (uses first district in the city) */}
      {primaryDistrict && (
        <AreaSummaryCard district={primaryDistrict} variant="full" />
      )}

      {/* Nursery grid */}
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Top nurseries in {city.name}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nurseries.map((nursery) => (
          <NurseryCard key={nursery.urn} nursery={nursery} showDistance={true} />
        ))}
      </div>

      {/* Explore districts within the city */}
      {city.districts.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Explore districts in {city.name}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Dive deeper into specific postcode districts for detailed area reports and nursery lists.
          </p>
          <div className="flex flex-wrap gap-2">
            {city.districts.map((d) => (
              <Link
                key={d}
                href={`/nurseries-in/${d.toLowerCase()}`}
                className="px-4 py-2 rounded-full border border-purple-200 bg-purple-50 text-purple-800 text-sm font-medium hover:bg-purple-100 hover:border-purple-300 transition"
              >
                {d}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Schools nearby */}
      <DistrictSchools lat={city.lat} lng={city.lng} district={city.name} />

      {/* Individual nursery links */}
      {nurseries.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Individual Nursery Pages</h2>
          <div className="flex flex-wrap gap-2">
            {nurseries.slice(0, 12).map((n) => (
              <Link
                key={n.urn}
                href={`/nursery/${n.urn}`}
                className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full hover:bg-blue-50 hover:text-blue-700"
              >
                {n.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* FAQ section */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <details key={faq.question} className="bg-gray-50 rounded-lg p-4">
              <summary className="font-medium text-gray-900 cursor-pointer">{faq.question}</summary>
              <p className="mt-2 text-gray-600 text-sm">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Back links */}
      <div className="mt-8 flex gap-4 justify-center">
        <Link
          href="/nurseries-in-city"
          className="inline-block px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
        >
          All cities
        </Link>
        <Link
          href="/search"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Search on map
        </Link>
      </div>

      {/* JSON-LD: City Place */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: city.name,
            url: `https://nurserymatch.com/nurseries-in-city/${city.slug}`,
            geo: {
              '@type': 'GeoCoordinates',
              latitude: city.lat,
              longitude: city.lng,
            },
            address: {
              '@type': 'PostalAddress',
              addressLocality: city.name,
              addressCountry: 'GB',
            },
          }),
        }}
      />

      {/* JSON-LD: Breadcrumbs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbSchema(
              crumbs.map((c) => ({
                name: c.name,
                url: c.href || `/nurseries-in-city/${city.slug}`,
              }))
            )
          ),
        }}
      />

      {/* JSON-LD: FAQ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqSchema(faqs)) }}
      />

      {/* JSON-LD: ItemList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `Best Nurseries in ${city.name}`,
            numberOfItems: totalCount,
            itemListElement: nurseries.slice(0, 10).map((n, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              item: {
                '@type': 'ChildCare',
                name: n.name,
                url: `https://nurserymatch.com/nursery/${n.urn}`,
                address: {
                  '@type': 'PostalAddress',
                  streetAddress: n.address_line1,
                  addressLocality: n.town,
                  postalCode: n.postcode,
                  addressCountry: 'GB',
                },
              },
            })),
          }),
        }}
      />

      <OglAttribution />
    </div>
  )
}
