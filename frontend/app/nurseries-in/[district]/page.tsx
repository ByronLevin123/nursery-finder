import { Metadata } from 'next'
import { getNurseriesInDistrict, getAreaSummary } from '@/lib/api'
import AreaSummaryCard from '@/components/AreaSummaryCard'
import NurseryCard from '@/components/NurseryCard'
import OglAttribution from '@/components/OglAttribution'
import Breadcrumbs from '@/components/Breadcrumbs'
import Link from 'next/link'
import { placeSchema, breadcrumbSchema, faqSchema, jsonLdScript } from '@/lib/schema'

interface Props {
  params: { district: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const district = params.district.toUpperCase()
  try {
    const { stats } = await getNurseriesInDistrict(district)
    const title = `Nurseries in ${district} — ${stats.total} Found`
    const description = `${stats.total} Ofsted-rated nurseries in ${district}. ${stats.outstanding} rated Outstanding. Compare grades, funded places and inspection dates.`
    const url = `/nurseries-in/${district.toLowerCase()}`
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
        images: [{ url: '/og-default.png', width: 1200, height: 630, alt: `Nurseries in ${district}` }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: ['/og-default.png'],
      },
    }
  } catch {
    return { title: `Nurseries in ${district} | NurseryMatch` }
  }
}

export default async function AreaPage({ params }: Props) {
  const district = params.district.toUpperCase()
  let nurseries, stats
  let area: Awaited<ReturnType<typeof getAreaSummary>> = null

  try {
    const [data, areaData] = await Promise.all([
      getNurseriesInDistrict(district),
      getAreaSummary(district).catch(() => null),
    ])
    nurseries = data.nurseries
    stats = data.stats
    area = areaData
  } catch {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Area not found</h1>
        <p className="text-gray-500">No nurseries found for district {district}.</p>
        <Link href="/search" className="text-blue-600 hover:underline mt-4 inline-block">Search instead →</Link>
      </div>
    )
  }

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: `Nurseries in ${district}` },
  ]

  const outstandingGoodPct = stats.total > 0 ? Math.round(((stats.outstanding + stats.good) / stats.total) * 100) : 0

  const faqs = [
    {
      question: `How many nurseries are in ${district}?`,
      answer: `${district} has ${stats.total} Ofsted-registered nurseries, of which ${stats.outstanding} are rated Outstanding and ${stats.good} are rated Good.`,
    },
    {
      question: `What percentage of nurseries in ${district} are Outstanding or Good?`,
      answer: `${outstandingGoodPct}% of nurseries in ${district} are rated Outstanding or Good by Ofsted.`,
    },
    {
      question: `Which is the best-rated nursery in ${district}?`,
      answer: `You can compare every Outstanding-rated nursery in ${district} on this page, sorted by Ofsted grade. Each listing links to the full Ofsted report.`,
    },
    {
      question: `Are there funded nursery places in ${district}?`,
      answer: `Yes — many nurseries in ${district} offer 15 or 30 hours of government-funded childcare for eligible 2, 3 and 4-year-olds. Each nursery profile shows the number of funded places available.`,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Nurseries in {district}
        </h1>
        <p className="text-gray-600">
          {stats.total} registered nurseries — {stats.outstanding} Outstanding, {stats.good} Good
        </p>
      </div>

      <AreaSummaryCard district={district} variant="full" />

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total nurseries', value: stats.total },
          { label: 'Outstanding', value: stats.outstanding },
          { label: 'Good', value: stats.good },
          { label: '% Outstanding/Good', value: stats.total > 0 ? `${Math.round(((stats.outstanding + stats.good) / stats.total) * 100)}%` : '0%' },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Nursery list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nurseries.map((nursery: any) => (
          <NurseryCard key={nursery.urn} nursery={nursery} showDistance={false} />
        ))}
      </div>

      {/* Why families love this area */}
      {area && (area.family_score || area.crime_rate_per_1000 || area.park_count_within_1km) && (
        <div className="mt-10 bg-blue-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Why families love {district}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {area.family_score && (
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{area.family_score}/100</p>
                <p className="text-xs text-gray-500 mt-1">Family Score</p>
              </div>
            )}
            {area.crime_rate_per_1000 != null && (
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{area.crime_rate_per_1000}</p>
                <p className="text-xs text-gray-500 mt-1">Crime rate per 1,000</p>
              </div>
            )}
            {area.park_count_within_1km != null && (
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{area.park_count_within_1km}</p>
                <p className="text-xs text-gray-500 mt-1">Parks within 1 km</p>
              </div>
            )}
          </div>
          {area.nearest_park_name && (
            <p className="text-sm text-gray-600 mt-3">
              Nearest green space: {area.nearest_park_name}
              {area.nearest_park_distance_m ? ` (${(area.nearest_park_distance_m / 1000).toFixed(1)} km)` : ''}
            </p>
          )}
        </div>
      )}

      {/* Getting around */}
      {area && (area.avg_sale_price_all || area.imd_decile) && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Getting around {district}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            {area.avg_sale_price_all && (
              <p>Average property price: <span className="font-medium text-gray-900">£{area.avg_sale_price_all.toLocaleString()}</span></p>
            )}
            {area.imd_decile && (
              <p>Deprivation decile: <span className="font-medium text-gray-900">{area.imd_decile}/10</span> (10 = least deprived)</p>
            )}
            {area.flood_risk_level && (
              <p>Flood risk: <span className="font-medium text-gray-900">{area.flood_risk_level}</span></p>
            )}
            {area.demand_rating && (
              <p>Housing demand: <span className="font-medium text-gray-900">{area.demand_rating}</span></p>
            )}
          </div>
        </div>
      )}

      {/* Internal links to nursery pages */}
      {nurseries.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Individual Nursery Pages</h2>
          <div className="flex flex-wrap gap-2">
            {nurseries.slice(0, 12).map((n: any) => (
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
      <div className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <details key={faq.question} className="bg-gray-50 rounded-lg p-4">
              <summary className="font-medium text-gray-900 cursor-pointer">{faq.question}</summary>
              <p className="mt-2 text-gray-600 text-sm">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Back to search */}
      <div className="mt-8 text-center">
        <Link
          href={`/search?postcode=${district}`}
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Search nurseries on map →
        </Link>
      </div>

      {/* JSON-LD: Place + Breadcrumb + FAQ + ItemList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(placeSchema({ district, postcode_district: district })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbSchema(
              crumbs.map((c) => ({ name: c.name, url: c.href || `/nurseries-in/${district.toLowerCase()}` }))
            )
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqSchema(faqs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `Nurseries in ${district}`,
            numberOfItems: stats.total,
            itemListElement: nurseries.slice(0, 10).map((n: any, i: number) => ({
              '@type': 'ListItem',
              position: i + 1,
              item: {
                '@type': 'ChildCare',
                name: n.name,
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
