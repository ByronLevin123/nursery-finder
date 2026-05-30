import { Metadata } from 'next'
import Breadcrumbs from '@/components/Breadcrumbs'
import Link from 'next/link'
import { breadcrumbSchema, jsonLdScript } from '@/lib/schema'

export const metadata: Metadata = {
  title: 'Browse Nurseries by City | NurseryMatch',
  description:
    'Compare Ofsted-rated nurseries in the UK\'s top 20 cities. London, Birmingham, Manchester and more — find the best nursery for your child.',
  alternates: { canonical: '/nurseries-in-city' },
  openGraph: {
    title: 'Browse Nurseries by City | NurseryMatch',
    description: 'Compare Ofsted-rated nurseries in the UK\'s top 20 cities.',
    url: '/nurseries-in-city',
    siteName: 'NurseryMatch',
    type: 'website',
    locale: 'en_GB',
  },
}

const CITIES = [
  { name: 'London',      slug: 'london' },
  { name: 'Birmingham',  slug: 'birmingham' },
  { name: 'Manchester',  slug: 'manchester' },
  { name: 'Leeds',       slug: 'leeds' },
  { name: 'Glasgow',     slug: 'glasgow' },
  { name: 'Liverpool',   slug: 'liverpool' },
  { name: 'Bristol',     slug: 'bristol' },
  { name: 'Sheffield',   slug: 'sheffield' },
  { name: 'Edinburgh',   slug: 'edinburgh' },
  { name: 'Cardiff',     slug: 'cardiff' },
  { name: 'Nottingham',  slug: 'nottingham' },
  { name: 'Newcastle',   slug: 'newcastle' },
  { name: 'Leicester',   slug: 'leicester' },
  { name: 'Southampton', slug: 'southampton' },
  { name: 'Brighton',    slug: 'brighton' },
  { name: 'Cambridge',   slug: 'cambridge' },
  { name: 'Oxford',      slug: 'oxford' },
  { name: 'York',        slug: 'york' },
  { name: 'Bath',        slug: 'bath' },
  { name: 'Reading',     slug: 'reading' },
]

export default function CityIndexPage() {
  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Browse by City' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse Nurseries by City</h1>
        <p className="text-gray-600">
          Compare Ofsted-rated nurseries across the UK&apos;s 20 largest cities.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {CITIES.map((city) => (
          <Link
            key={city.slug}
            href={`/nurseries-in-city/${city.slug}`}
            className="flex items-center justify-center px-4 py-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 font-medium hover:bg-indigo-100 hover:border-indigo-300 transition text-center"
          >
            {city.name}
          </Link>
        ))}
      </div>

      <div className="mt-10 text-center">
        <p className="text-gray-500 text-sm mb-4">
          Looking for a smaller town? Try our town directory.
        </p>
        <Link
          href="/nurseries-in-town"
          className="inline-block px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
        >
          Browse by town
        </Link>
      </div>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbSchema(
              crumbs.map((c) => ({ name: c.name, url: c.href || '/nurseries-in-city' }))
            )
          ),
        }}
      />
    </div>
  )
}
