import { Metadata } from 'next'
import NearMeClient from './NearMeClient'
import OglAttribution from '@/components/OglAttribution'

export const metadata: Metadata = {
  title: 'Nurseries Near Me — Find Local Nurseries | NurseryMatch',
  description:
    'Find Ofsted-rated nurseries near you. Compare ratings, fees, and availability at nurseries in your area.',
  alternates: { canonical: '/nurseries-near-me' },
  openGraph: {
    title: 'Nurseries Near Me — Find Local Nurseries | NurseryMatch',
    description:
      'Find Ofsted-rated nurseries near you. Compare ratings, fees, and availability at nurseries in your area.',
    url: '/nurseries-near-me',
    siteName: 'NurseryMatch',
    type: 'website',
    locale: 'en_GB',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Nurseries Near Me' }],
  },
}

export default function NurseriesNearMePage() {
  return (
    <div className="bg-gradient-to-b from-indigo-50 via-white to-white min-h-screen">
      <div className="max-w-lg mx-auto px-4 py-16">
        <NearMeClient />
      </div>
      <div className="max-w-lg mx-auto px-4 pb-8">
        <OglAttribution />
      </div>
    </div>
  )
}
