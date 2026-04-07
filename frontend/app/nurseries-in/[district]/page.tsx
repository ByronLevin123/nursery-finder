import { Metadata } from 'next'
import { getNurseriesInDistrict } from '@/lib/api'
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
        siteName: 'NurseryFinder',
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
    return { title: `Nurseries in ${district} | NurseryFinder` }
  }
}

export default async function AreaPage({ params }: Props) {
  const district = params.district.toUpperCase()
  let nurseries, stats

  try {
    const data = await getNurseriesInDistrict(district)
    nurseries = data.nurseries
    stats = data.stats
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

  const faqs = [
    {
      question: `How many nurseries are in ${district}?`,
      answer: `${district} has ${stats.total} Ofsted-registered nurseries, of which ${stats.outstanding} are rated Outstanding and ${stats.good} are rated Good.`,
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
