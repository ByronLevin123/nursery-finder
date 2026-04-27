import { Metadata } from 'next'
import { getBlogPosts } from '@/lib/api'
import Breadcrumbs from '@/components/Breadcrumbs'
import Link from 'next/link'
import OglAttribution from '@/components/OglAttribution'
import { breadcrumbSchema, jsonLdScript } from '@/lib/schema'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Nursery Guides & Advice | NurseryMatch',
  description:
    'Helpful guides for UK parents: choosing a nursery, understanding Ofsted ratings, funded childcare hours, and more.',
  alternates: { canonical: '/guides' },
  openGraph: {
    title: 'Nursery Guides & Advice | NurseryMatch',
    description: 'Helpful guides for UK parents on nurseries, Ofsted, and childcare.',
    url: '/guides',
    siteName: 'NurseryMatch',
    type: 'website',
    locale: 'en_GB',
  },
}

export default async function GuidesIndexPage() {
  const posts = await getBlogPosts()

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Guides' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Nursery Guides & Advice</h1>
        <p className="text-gray-600">
          Practical guidance for UK parents navigating nurseries, Ofsted ratings, and funded childcare.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="text-gray-500">No guides available yet. Check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/guides/${post.slug}`}
              className="block bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{post.title}</h2>
              <p className="text-sm text-gray-600 mb-3 line-clamp-3">{post.excerpt}</p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{post.author}</span>
                {post.date && (
                  <time dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </time>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbSchema(crumbs.map((c) => ({ name: c.name, url: c.href || '/guides' })))
          ),
        }}
      />

      <OglAttribution />
    </div>
  )
}
