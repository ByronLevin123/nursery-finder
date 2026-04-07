import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import Footer from '@/components/Footer'
import Nav from '@/components/Nav'
import { SessionProvider } from '@/components/SessionProvider'
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
      <body className="font-sans antialiased">
        <SessionProvider>
          <Nav />
          <main className="min-h-screen">
            {children}
          </main>
          <Footer />
          <Analytics />
        </SessionProvider>
      </body>
    </html>
  )
}
