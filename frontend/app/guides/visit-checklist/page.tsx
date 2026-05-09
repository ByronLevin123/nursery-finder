import { Metadata } from 'next'
import Breadcrumbs from '@/components/Breadcrumbs'
import VisitChecklist from '@/components/VisitChecklist'
import OglAttribution from '@/components/OglAttribution'
import { breadcrumbSchema, jsonLdScript } from '@/lib/schema'

export const metadata: Metadata = {
  title: 'Nursery Visit Checklist — What to Look For | NurseryMatch',
  description:
    'A comprehensive checklist for parents visiting nurseries. Know what to look for, what questions to ask, and how to compare nurseries side by side.',
  alternates: { canonical: '/guides/visit-checklist' },
  openGraph: {
    title: 'Nursery Visit Checklist — What to Look For | NurseryMatch',
    description:
      'A comprehensive checklist for parents visiting nurseries. Know what to look for and what questions to ask.',
    url: '/guides/visit-checklist',
    siteName: 'NurseryMatch',
    type: 'website',
    locale: 'en_GB',
  },
}

export default function VisitChecklistPage() {
  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Guides', href: '/guides' },
    { name: 'Visit Checklist' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Nursery Visit Checklist</h1>
        <p className="text-gray-600 leading-relaxed">
          Visiting a nursery can feel overwhelming — there is so much to take in. Use this checklist
          to make sure you cover all the important areas during your visit. Tick items off as you go,
          add your own notes at the bottom, and print it out to take with you. If you are comparing
          several nurseries, visit each nursery&apos;s profile page to get a checklist tailored to
          that setting.
        </p>
      </div>

      <VisitChecklist />

      <OglAttribution />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbSchema(
              crumbs.map((c) => ({
                name: c.name,
                url: c.href || '/guides/visit-checklist',
              }))
            )
          ),
        }}
      />
    </div>
  )
}
