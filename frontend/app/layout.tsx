import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/react'
import CookieBanner from '@/components/CookieBanner'
import Footer from '@/components/Footer'
import MobileNav from '@/components/MobileNav'
import Nav from '@/components/Nav'
import { SessionProvider } from '@/components/SessionProvider'
import { organizationSchema, websiteSchema, jsonLdScript } from '@/lib/schema'
import { API_URL } from '@/lib/api'
import './globals.css'

const SITE_URL = 'https://nurserymatch.com'

export const viewport: Viewport = {
  themeColor: '#4f46e5',
}

export const metadata: Metadata = {
  title: {
    template: '%s | NurseryMatch',
    default: 'NurseryMatch — Compare UK Nurseries by Ofsted Grade',
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
    title: 'NurseryMatch — Compare UK Nurseries by Ofsted Grade',
    description:
      'Compare 27,000+ UK nurseries with real Ofsted ratings, family scores by area, live property data, and parent reviews.',
    url: SITE_URL,
    siteName: 'NurseryMatch',
    locale: 'en_GB',
    type: 'website',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'NurseryMatch — UK nursery comparison',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NurseryMatch — Compare UK Nurseries by Ofsted Grade',
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
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
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
          <>
            {/* Stub: queues custom events fired before the deferred Plausible
                script loads. Once the real script arrives it replays the
                queue. Without this, early trackEvent() calls (e.g. on a
                quick checkout completion) would be silently lost. */}
            <Script id="plausible-stub" strategy="beforeInteractive">
              {`window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}`}
            </Script>
            <Script
              defer
              data-domain={plausibleDomain}
              src="https://plausible.io/js/script.outbound-links.js"
              strategy="afterInteractive"
            />
          </>
        )}
      </head>
      <body className="font-sans antialiased">
        <SessionProvider>
          <Nav />
          <main className="min-h-screen pb-16 md:pb-0">{children}</main>
          <Footer />
          <MobileNav />
          <CookieBanner />
          <Analytics />
        </SessionProvider>
      </body>
    </html>
  )
}
