import { Metadata } from 'next'
import SearchClient from './SearchClient'

export const metadata: Metadata = {
  title: 'Search Nurseries Near You',
  description:
    'Search 27,000+ Ofsted-rated nurseries by postcode, area, or name. Filter by grade, funded places, and more.',
  alternates: { canonical: '/search' },
  openGraph: {
    title: 'Search Nurseries Near You | NurseryMatch',
    description:
      'Search 27,000+ Ofsted-rated nurseries by postcode, area, or name.',
    url: '/search',
    siteName: 'NurseryMatch',
    type: 'website',
    locale: 'en_GB',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'NurseryMatch nursery search' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Search Nurseries Near You | NurseryMatch',
    description:
      'Search 27,000+ Ofsted-rated nurseries by postcode, area, or name.',
    images: ['/og-default.png'],
  },
}

export default function SearchPage() {
  return <SearchClient />
}
