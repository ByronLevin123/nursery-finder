import type { Metadata } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/react'
import Footer from '@/components/Footer'
import Nav from '@/components/Nav'
import { SessionProvider } from '@/components/SessionProvider'
import { organizationSchema, websiteSchema, jsonLdScript } from '@/lib/schema'
import './globals.css'

const SITE_URL = 'https://nursery-finder.vercel.app'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nursery-finder-6u7r.onrender.com'

export const metadata: Metadata = {
  title: {
    template: '%s | NurseryFinder',
    default: 'NurseryFinder — Compare UK Nurseries by Ofsted Grade',
  },
  description:
    'Find and compare Ofsted-rated nurseries near you. Search by postcode, filter by grade, and find funded places.',
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  keywords: [
    'UK nurseries',
    'Ofsted ratings',
    'nursery search',
    'childcare',
    'family areas UK',
    'nursery comparison',
  ],
  openGraph: {
    title: 'NurseryFinder — Compare UK Nurseries by Ofsted Grade',
    description:
      'Compare 27,000+ UK nurseries with real Ofsted ratings, family scores by area, live property data, and parent reviews.',
    url: SITE_URL,
    siteName: 'NurseryFinder',
    locale: 'en_GB',
    type: 'website',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'NurseryFinder — UK nursery comparison',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NurseryFinder — Compare UK Nurseries by Ofsted Grade',
    description:
      'Compare 27,000+ UK nurseries with Ofsted ratings, family scores, and live property data.',
    images: ['/og-default.png'],
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  const apiOrigin = (() => {
    try {
      return new URL(API_URL).origin
    } catch {
      return null
    }
  })()
  return (
    <html lang="en">
      <head>
        {apiOrigin && <link rel="preconnect" href={apiOrigin} crossOrigin="" />}
        <link rel="dns-prefetch" href="https://api.postcodes.io" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationSchema()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteSchema()) }}
        />
        {plausibleDomain && (
          <Script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="font-sans antialiased">
        <SessionProvider>
          <Nav />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <Analytics />
        </SessionProvider>
      </body>
    </html>
  )
}
