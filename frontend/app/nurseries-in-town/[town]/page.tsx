import { Metadata } from 'next'
import { getNurseriesInTown } from '@/lib/api'
import NurseryCard from '@/components/NurseryCard'
import OglAttribution from '@/components/OglAttribution'
import Breadcrumbs from '@/components/Breadcrumbs'
import Link from 'next/link'
import { breadcrumbSchema, faqSchema, jsonLdScript } from '@/lib/schema'

interface Props {
  params: { town: string }
}

function formatTown(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const town = formatTown(params.town)
  try {
    const { stats } = await getNurseriesInTown(params.town)
    const title = `Best Nurseries in ${town} — ${stats.total} Compared | NurseryMatch`
    const description = `Compare ${stats.total} Ofsted-rated nurseries in ${town}. ${stats.outstanding} Outstanding, ${stats.good} Good. Find the best nursery for your child.`
    const url = `/nurseries-in-town/${encodeURIComponent(params.town.toLowerCase())}`
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
        images: [{ url: '/og-default.png', width: 1200, height: 630, alt: `Nurseries in ${town}` }],
      },
      twitter: { card: 'summary_large_image', title, description, images: ['/og-default.png'] },
    }
  } catch {
    return { title: `Best Nurseries in ${town} | NurseryMatch` }
  }
}

export default async function TownPage({ params }: Props) {
  const townDisplay = formatTown(params.town)
  let nurseries, stats, townName: string

  try {
    const data = await getNurseriesInTown(params.town)
    nurseries = data.data
    stats = data.stats
    townName = data.town || townDisplay
  } catch {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Town not found</h1>
        <p className="text-gray-500">No nurseries found in {townDisplay}.</p>
        <Link href="/nurseries-in-town" className="text-blue-600 hover:underline mt-4 inline-block">
          Browse all towns
        </Link>
      </div>
    )
  }

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Towns', href: '/nurseries-in-town' },
    { name: `Nurseries in ${townName}` },
  ]

  const outstandingPct = stats.total > 0 ? Math.round(((stats.outstanding + stats.good) / stats.total) * 100) : 0

  const faqs = [
    {
      question: `How many nurseries are in ${townName}?`,
      answer: `${townName} has ${stats.total} Ofsted-registered nurseries, of which ${stats.outstanding} are rated Outstanding and ${stats.good} are rated Good.`,
    },
    {
      question: `What percentage of nurseries in ${townName} are rated Outstanding or Good?`,
      answer: `${outstandingPct}% of nurseries in ${townName} are rated Outstanding or Good by Ofsted.`,
    },
    {
      question: `How do I find the best nursery in ${townName}?`,
      answer: `This page lists all ${stats.total} nurseries in ${townName} sorted by Ofsted grade. Click any nursery to see its full profile including inspection details, funded places, and parent reviews.`,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Best Nurseries in {townName}
        </h1>
        <p className="text-gray-600">
          {stats.total} nurseries in {townName} — {stats.outstanding} Outstanding, {stats.good} Good
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total nurseries', value: stats.total },
          { label: 'Outstanding', value: stats.outstanding },
          { label: 'Good', value: stats.good },
          { label: '% Outstanding/Good', value: `${outstandingPct}%` },
        ].map((s) => (
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
          href="/nurseries-in-town"
          className="inline-block px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
        >
          All towns
        </Link>
        <Link
          href="/search"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Search on map
        </Link>
      </div>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbSchema(
              crumbs.map((c) => ({
                name: c.name,
                url: c.href || `/nurseries-in-town/${encodeURIComponent(params.town.toLowerCase())}`,
              }))
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
            name: `Best Nurseries in ${townName}`,
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
