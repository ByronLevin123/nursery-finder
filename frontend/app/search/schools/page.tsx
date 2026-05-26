import { Metadata } from 'next'
import SchoolSearchClient from './SchoolSearchClient'

export const metadata: Metadata = {
  title: 'Find Schools Near You | NurseryMatch',
  description:
    'Search for primary and secondary schools near you. Compare Ofsted ratings, pupil numbers, and more.',
  alternates: { canonical: '/search/schools' },
  openGraph: {
    title: 'Find Schools Near You | NurseryMatch',
    description:
      'Search for primary and secondary schools near you. Compare Ofsted ratings, pupil numbers, and more.',
    url: '/search/schools',
    siteName: 'NurseryMatch',
    type: 'website',
    locale: 'en_GB',
  },
}

export default function SchoolSearchPage() {
  return <SchoolSearchClient />
}
