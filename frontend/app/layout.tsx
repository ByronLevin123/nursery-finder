import type { Metadata } from 'next'
import Footer from '@/components/Footer'
import Nav from '@/components/Nav'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s | NurseryFinder',
    default: 'NurseryFinder — Compare UK Nurseries by Ofsted Grade',
  },
  description: 'Find and compare Ofsted-rated nurseries near you. Search by postcode, filter by grade, and find funded places.',
  metadataBase: new URL('https://nursery-finder.vercel.app'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Plausible Analytics — GDPR compliant, cookieless */}
        <script
          defer
          data-domain="nursery-finder.vercel.app"
          src="https://plausible.io/js/plausible.js"
        />
      </head>
      <body className="font-sans antialiased">
        <Nav />
        <main className="min-h-screen">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
