import { Metadata } from 'next'
import { getTowns } from '@/lib/api'
import Breadcrumbs from '@/components/Breadcrumbs'
import Link from 'next/link'
import { breadcrumbSchema, jsonLdScript } from '@/lib/schema'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Browse Nurseries by Town | CompareTheNursery',
  description:
    'Browse Ofsted-rated nurseries by town across the UK. Find and compare the best nurseries near you.',
  alternates: { canonical: '/nurseries-in-town' },
  openGraph: {
    title: 'Browse Nurseries by Town | CompareTheNursery',
    description: 'Browse Ofsted-rated nurseries by town across the UK.',
    url: '/nurseries-in-town',
    siteName: 'CompareTheNursery',
    type: 'website',
    locale: 'en_GB',
  },
}

export default async function TownIndexPage() {
  const towns = await getTowns(200)

  // Group alphabetically
  const grouped: Record<string, typeof towns> = {}
  for (const town of towns) {
    const letter = town.name[0]?.toUpperCase() || '#'
    if (!grouped[letter]) grouped[letter] = []
    grouped[letter].push(town)
  }
  // Sort groups by letter, and towns within each group alphabetically
  const letters = Object.keys(grouped).sort()
  for (const letter of letters) {
    grouped[letter].sort((a, b) => a.name.localeCompare(b.name))
  }

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Browse by Town' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse Nurseries by Town</h1>
        <p className="text-gray-600">
          Explore {towns.length} towns with Ofsted-rated nurseries across the UK.
        </p>
      </div>

      {/* Letter jump links */}
      <div className="flex flex-wrap gap-2 mb-8">
        {letters.map((letter) => (
          <a
            key={letter}
            href={`#letter-${letter}`}
            className="w-8 h-8 flex items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-700 hover:bg-blue-100 hover:text-blue-700"
          >
            {letter}
          </a>
        ))}
      </div>

      {/* Town grid by letter */}
      {letters.map((letter) => (
        <div key={letter} id={`letter-${letter}`} className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-1">
            {letter}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {grouped[letter].map((town) => (
              <Link
                key={town.name}
                href={`/nurseries-in-town/${encodeURIComponent(town.name.toLowerCase())}`}
                className="flex justify-between items-center px-3 py-2 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 text-sm"
              >
                <span className="font-medium truncate">{town.name}</span>
                <span className="text-gray-400 ml-2 shrink-0">{town.count}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbSchema(
              crumbs.map((c) => ({ name: c.name, url: c.href || '/nurseries-in-town' }))
            )
          ),
        }}
      />
    </div>
  )
}
