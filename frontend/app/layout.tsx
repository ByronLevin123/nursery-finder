import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/react'
import CookieBanner from '@/components/CookieBanner'
import ErrorBoundary from '@/components/ErrorBoundary'
import Footer from '@/components/Footer'
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
  other: {
    // AI search visibility: help AI crawlers and citation engines find
    // structured data about this site.
    'ai:description':
      'NurseryMatch is a free UK nursery comparison platform covering 27,000+ Ofsted-rated nurseries. Search by postcode, compare nurseries, view area family scores, property prices, school data, and parent reviews. Public API available.',
    'ai:llms.txt': 'https://nurserymatch.com/llms.txt',
    'citation_title': 'NurseryMatch — Compare UK Nurseries by Ofsted Grade',
    'citation_public_url': 'https://nurserymatch.com',
    'citation_language': 'en',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  const bingVerification = process.env.NEXT_PUBLIC_BING_VERIFICATION
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_ID
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
        {/* AI search discovery: llms.txt and ai-plugin.json for LLM crawlers,
            ChatGPT, Perplexity, Claude, and Google AI Overviews */}
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM context file" />
        <link rel="alternate" type="application/json" href="/.well-known/ai-plugin.json" title="AI plugin manifest" />
        {/* Bing Webmaster Tools verification — set NEXT_PUBLIC_BING_VERIFICATION
            in Vercel to the content value Bing gives you when you add the site. */}
        {bingVerification && <meta name="msvalidate.01" content={bingVerification} />}
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
        {googleAdsId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${googleAdsId}');`}
            </Script>
          </>
        )}
        {adsenseId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
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
          {/* ErrorBoundary on the main content tree only — keeps nav and
              footer rendered if a route component throws, so the user
              can still navigate away. */}
          <main className="min-h-screen">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
          <Footer />
          <CookieBanner />
          <Analytics />
        </SessionProvider>
      </body>
    </html>
  )
}
