import { Metadata } from 'next'
import { API_URL } from '@/lib/api'
import Link from 'next/link'
import GradeBadge from '@/components/GradeBadge'
import OglAttribution from '@/components/OglAttribution'

interface Props {
  params: { token: string }
}

export const metadata: Metadata = {
  title: 'Shared Shortlist | NurseryMatch',
  description: 'A nursery shortlist shared with you by another parent.',
}

export default async function SharedShortlistPage({ params }: Props) {
  let data: any = null
  try {
    const res = await fetch(`${API_URL}/api/v1/shortlist/shared/${params.token}`, {
      cache: 'no-store',
    })
    if (res.ok) data = await res.json()
  } catch {}

  if (!data || !data.nurseries?.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Shortlist not found</h1>
        <p className="text-gray-500 mb-6">This shared shortlist may have expired or doesn&apos;t exist.</p>
        <Link href="/search" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
          Search nurseries
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {data.name || 'Shared Nursery Shortlist'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {data.nurseries.length} {data.nurseries.length === 1 ? 'nursery' : 'nurseries'} shared with you
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.nurseries.map((n: any) => (
          <Link
            key={n.urn}
            href={`/nursery/${n.urn}`}
            className="block bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-semibold text-gray-900">{n.name}</p>
                <p className="text-sm text-gray-500">{n.town}{n.postcode ? `, ${n.postcode}` : ''}</p>
              </div>
              <GradeBadge grade={n.ofsted_overall_grade} size="sm" />
            </div>
            <div className="flex gap-3 text-xs text-gray-600">
              {n.total_places && <span>{n.total_places} places</span>}
              {n.fee_avg_monthly && <span>~&pound;{n.fee_avg_monthly}/mo</span>}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/search"
          className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700"
        >
          Start your own search
        </Link>
      </div>

      <OglAttribution />
    </div>
  )
}
