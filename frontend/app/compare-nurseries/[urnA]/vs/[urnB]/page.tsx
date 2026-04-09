import { Metadata } from 'next'
import { getNursery, Nursery } from '@/lib/api'
import Breadcrumbs from '@/components/Breadcrumbs'
import OglAttribution from '@/components/OglAttribution'
import Link from 'next/link'
import { nurserySchema, breadcrumbSchema, jsonLdScript } from '@/lib/schema'

interface Props {
  params: { urnA: string; urnB: string }
}

function gradePriority(grade: string | null): number {
  const order: Record<string, number> = { Outstanding: 1, Good: 2, 'Requires Improvement': 3, Inadequate: 4 }
  return order[grade || ''] || 5
}

function gradeColor(grade: string | null): string {
  switch (grade) {
    case 'Outstanding': return 'text-green-700 bg-green-50'
    case 'Good': return 'text-blue-700 bg-blue-50'
    case 'Requires Improvement': return 'text-amber-700 bg-amber-50'
    case 'Inadequate': return 'text-red-700 bg-red-50'
    default: return 'text-gray-700 bg-gray-50'
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const [a, b] = await Promise.all([getNursery(params.urnA), getNursery(params.urnB)])
    const title = `${a.name} vs ${b.name} — CompareTheNursery`
    const description = `Side-by-side comparison of ${a.name} (${a.ofsted_overall_grade || 'Unrated'}) and ${b.name} (${b.ofsted_overall_grade || 'Unrated'}). Compare Ofsted grades, places, fees, and more.`
    return {
      title,
      description,
      alternates: { canonical: `/compare-nurseries/${params.urnA}/vs/${params.urnB}` },
      openGraph: {
        title,
        description,
        siteName: 'CompareTheNursery',
        type: 'website',
        locale: 'en_GB',
      },
    }
  } catch {
    return { title: 'Compare Nurseries | CompareTheNursery' }
  }
}

function CompareRow({
  label,
  valueA,
  valueB,
  winCondition,
}: {
  label: string
  valueA: string | number | null
  valueB: string | number | null
  winCondition?: 'higher' | 'lower' | 'grade' | null
}) {
  let winnerA = false
  let winnerB = false

  if (winCondition && valueA != null && valueB != null) {
    if (winCondition === 'higher') {
      if (Number(valueA) > Number(valueB)) winnerA = true
      else if (Number(valueB) > Number(valueA)) winnerB = true
    } else if (winCondition === 'lower') {
      if (Number(valueA) < Number(valueB)) winnerA = true
      else if (Number(valueB) < Number(valueA)) winnerB = true
    } else if (winCondition === 'grade') {
      const ga = gradePriority(String(valueA))
      const gb = gradePriority(String(valueB))
      if (ga < gb) winnerA = true
      else if (gb < ga) winnerB = true
    }
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="py-3 px-4 text-sm font-medium text-gray-700 w-1/3">{label}</td>
      <td className={`py-3 px-4 text-sm text-center ${winnerA ? 'font-semibold text-green-700' : 'text-gray-600'}`}>
        {valueA ?? '-'}
        {winnerA && <span className="ml-1 text-green-600 text-xs">&#9733;</span>}
      </td>
      <td className={`py-3 px-4 text-sm text-center ${winnerB ? 'font-semibold text-green-700' : 'text-gray-600'}`}>
        {valueB ?? '-'}
        {winnerB && <span className="ml-1 text-green-600 text-xs">&#9733;</span>}
      </td>
    </tr>
  )
}

export default async function CompareNurseriesPage({ params }: Props) {
  let nurseryA: Nursery, nurseryB: Nursery

  try {
    ;[nurseryA, nurseryB] = await Promise.all([getNursery(params.urnA), getNursery(params.urnB)])
  } catch {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Nursery not found</h1>
        <p className="text-gray-500">One or both nurseries could not be found.</p>
        <Link href="/search" className="text-blue-600 hover:underline mt-4 inline-block">
          Search nurseries
        </Link>
      </div>
    )
  }

  const distance =
    nurseryA.lat && nurseryA.lng && nurseryB.lat && nurseryB.lng
      ? haversineKm(nurseryA.lat, nurseryA.lng, nurseryB.lat, nurseryB.lng).toFixed(1)
      : null

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Compare', href: '/compare' },
    { name: `${nurseryA.name} vs ${nurseryB.name}` },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />

      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
        {nurseryA.name} vs {nurseryB.name}
      </h1>
      <p className="text-gray-500 mb-6">
        Side-by-side comparison of two nurseries
        {distance && <> — {distance} km apart</>}
      </p>

      {/* Grade badges header */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[nurseryA, nurseryB].map((n) => (
          <div key={n.urn} className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <h2 className="font-semibold text-gray-900 mb-2 line-clamp-2">{n.name}</h2>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${gradeColor(n.ofsted_overall_grade)}`}>
              {n.ofsted_overall_grade || 'Not yet rated'}
            </span>
            <p className="text-xs text-gray-500 mt-2">{n.town}{n.postcode ? `, ${n.postcode}` : ''}</p>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase w-1/3">
                Metric
              </th>
              <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase">
                {nurseryA.name.length > 25 ? nurseryA.name.slice(0, 25) + '...' : nurseryA.name}
              </th>
              <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase">
                {nurseryB.name.length > 25 ? nurseryB.name.slice(0, 25) + '...' : nurseryB.name}
              </th>
            </tr>
          </thead>
          <tbody>
            <CompareRow
              label="Ofsted Grade"
              valueA={nurseryA.ofsted_overall_grade}
              valueB={nurseryB.ofsted_overall_grade}
              winCondition="grade"
            />
            <CompareRow label="Town" valueA={nurseryA.town} valueB={nurseryB.town} />
            <CompareRow
              label="Total Places"
              valueA={nurseryA.total_places}
              valueB={nurseryB.total_places}
              winCondition="higher"
            />
            <CompareRow
              label="Funded Places (2yr)"
              valueA={nurseryA.places_funded_2yr}
              valueB={nurseryB.places_funded_2yr}
              winCondition="higher"
            />
            <CompareRow
              label="Funded Places (3-4yr)"
              valueA={nurseryA.places_funded_3_4yr}
              valueB={nurseryB.places_funded_3_4yr}
              winCondition="higher"
            />
            <CompareRow
              label="Avg Fee (monthly)"
              valueA={nurseryA.fee_avg_monthly ? `£${nurseryA.fee_avg_monthly}` : null}
              valueB={nurseryB.fee_avg_monthly ? `£${nurseryB.fee_avg_monthly}` : null}
              winCondition="lower"
            />
            <CompareRow
              label="Last Inspection"
              valueA={
                nurseryA.last_inspection_date
                  ? new Date(nurseryA.last_inspection_date).toLocaleDateString('en-GB', {
                      month: 'short',
                      year: 'numeric',
                    })
                  : null
              }
              valueB={
                nurseryB.last_inspection_date
                  ? new Date(nurseryB.last_inspection_date).toLocaleDateString('en-GB', {
                      month: 'short',
                      year: 'numeric',
                    })
                  : null
              }
            />
            <CompareRow
              label="Review Rating"
              valueA={nurseryA.review_avg_rating ? `${nurseryA.review_avg_rating}/5` : nurseryA.google_rating ? `${nurseryA.google_rating}/5` : null}
              valueB={nurseryB.review_avg_rating ? `${nurseryB.review_avg_rating}/5` : nurseryB.google_rating ? `${nurseryB.google_rating}/5` : null}
              winCondition="higher"
            />
            {distance && (
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-sm font-medium text-gray-700" colSpan={3}>
                  Distance between nurseries: <span className="font-semibold">{distance} km</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CTA buttons */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link
          href={`/nursery/${nurseryA.urn}`}
          className="block text-center px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium"
        >
          View {nurseryA.name.length > 20 ? nurseryA.name.slice(0, 20) + '...' : nurseryA.name}
        </Link>
        <Link
          href={`/nursery/${nurseryB.urn}`}
          className="block text-center px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium"
        >
          View {nurseryB.name.length > 20 ? nurseryB.name.slice(0, 20) + '...' : nurseryB.name}
        </Link>
      </div>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(nurserySchema(nurseryA)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(nurserySchema(nurseryB)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbSchema(
              crumbs.map((c) => ({
                name: c.name,
                url: c.href || `/compare-nurseries/${params.urnA}/vs/${params.urnB}`,
              }))
            )
          ),
        }}
      />

      <OglAttribution />
    </div>
  )
}
