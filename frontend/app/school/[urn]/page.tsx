import { Metadata } from 'next'
import { getSchool } from '@/lib/api'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
import GradeBadge from '@/components/GradeBadge'
import OglAttribution from '@/components/OglAttribution'
import ShortlistButton from '@/components/ShortlistButton'
import dynamic from 'next/dynamic'

const SingleNurseryMap = dynamic(() => import('@/components/SingleNurseryMap'), { ssr: false })

function districtFromPostcode(postcode: string | null | undefined): string | null {
  if (!postcode) return null
  const m = postcode.toUpperCase().match(/^([A-Z]{1,2}\d[A-Z\d]?)/)
  return m ? m[1] : null
}

function isStaleInspection(dateStr: string | null): boolean {
  if (!dateStr) return false
  const inspDate = new Date(dateStr)
  const fourYearsAgo = new Date()
  fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4)
  return inspDate < fourYearsAgo
}

export async function generateMetadata({ params }: { params: { urn: string } }): Promise<Metadata> {
  try {
    const school = await getSchool(params.urn)
    const title = `${school.name} — ${school.ofsted_rating || 'Rating Pending'} ${school.phase || ''} School`
    const description = `${school.name} in ${school.town} is rated ${school.ofsted_rating || 'not yet rated'} by Ofsted. ${school.pupils ? `${school.pupils.toLocaleString()} pupils.` : ''} ${school.age_range ? `Ages ${school.age_range}.` : ''}`
    const url = `/school/${school.urn}`
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
      },
    }
  } catch {
    return { title: 'School not found | NurseryMatch' }
  }
}

export default async function SchoolPage({ params }: { params: { urn: string } }) {
  let school
  try {
    school = await getSchool(params.urn)
  } catch {
    notFound()
  }

  const district = districtFromPostcode(school.postcode)
  const stale = isStaleInspection(school.last_inspection_date)

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Schools', href: '/search/schools' },
    ...(district
      ? [{ name: `Schools in ${district}`, href: `/search/schools?q=${district}` }]
      : []),
    { name: school.name },
  ]

  const inspectionFormatted = school.last_inspection_date
    ? new Date(school.last_inspection_date).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />

      {/* Stale inspection banner */}
      {stale && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-amber-500 text-lg flex-shrink-0">&#9888;&#65039;</span>
            <div>
              <p className="text-amber-800 font-medium text-sm">Inspection data may be out of date</p>
              <p className="text-amber-700 text-sm mt-1">
                This school was last inspected on {inspectionFormatted} — over 4 years ago.
                The grade shown may not reflect current quality.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
        <p className="text-gray-500 mt-1">
          {school.town}{school.local_authority ? `, ${school.local_authority}` : ''}
        </p>
      </div>

      {/* Rating & badges */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <GradeBadge grade={school.ofsted_rating} size="lg" />
        {school.phase && (
          <span className="text-sm px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full font-medium">
            {school.phase}
          </span>
        )}
        {school.type && (
          <span className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
            {school.type}
          </span>
        )}
        <ShortlistButton urn={school.urn} type="school" />
      </div>

      {/* Key info badges */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {school.pupils && (
          <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">
            {school.pupils.toLocaleString()} pupils
          </span>
        )}
        {school.age_range && (
          <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">
            Ages {school.age_range}
          </span>
        )}
        {inspectionFormatted && (
          <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">
            Inspected {inspectionFormatted}
          </span>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 text-sm mb-2">Address</h2>
          <p className="text-sm text-gray-600">
            {school.address && <>{school.address}<br /></>}
            {school.town && <>{school.town}<br /></>}
            {school.postcode}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 text-sm mb-2">Details</h2>
          <dl className="text-sm text-gray-600 space-y-1">
            {school.type && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Type</dt>
                <dd>{school.type}</dd>
              </div>
            )}
            {school.phase && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Phase</dt>
                <dd>{school.phase}</dd>
              </div>
            )}
            {school.age_range && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Age range</dt>
                <dd>{school.age_range}</dd>
              </div>
            )}
            {school.pupils && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Pupils</dt>
                <dd>{school.pupils.toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Website link */}
      {school.website && (
        <div className="mb-6">
          <a
            href={school.website.startsWith('http') ? school.website : `https://${school.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            Visit school website
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}

      {/* Map */}
      {school.lat && school.lng && (
        <div className="mb-6">
          <h2 className="font-semibold text-gray-800 mb-2">Location</h2>
          <div className="h-64 rounded-lg overflow-hidden border border-gray-200">
            <SingleNurseryMap lat={school.lat} lng={school.lng} name={school.name} />
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="mt-8">
        <Link href="/search/schools" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
          &larr; Back to school search
        </Link>
      </div>

      <OglAttribution />
    </div>
  )
}
