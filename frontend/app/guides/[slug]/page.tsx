import { Metadata } from 'next'
import { getBlogPost, getBlogPosts } from '@/lib/api'
import Breadcrumbs from '@/components/Breadcrumbs'
import Link from 'next/link'
import OglAttribution from '@/components/OglAttribution'
import { breadcrumbSchema, jsonLdScript } from '@/lib/schema'

export const dynamic = 'force-dynamic'

interface Props {
  params: { slug: string }
}

/** Simple markdown to HTML — handles headings, bold, links, and paragraphs */
function renderMarkdown(md: string): string {
  const lines = md.split('\n')
  const htmlParts: string[] = []
  let inParagraph = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Empty line closes a paragraph
    if (!trimmed) {
      if (inParagraph) {
        htmlParts.push('</p>')
        inParagraph = false
      }
      continue
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      if (inParagraph) {
        htmlParts.push('</p>')
        inParagraph = false
      }
      const level = headingMatch[1].length
      const text = inlineFormat(headingMatch[2])
      const tag = `h${level}`
      const classes: Record<number, string> = {
        1: 'text-3xl font-bold text-gray-900 mb-4 mt-8',
        2: 'text-2xl font-semibold text-gray-900 mb-3 mt-6',
        3: 'text-xl font-semibold text-gray-800 mb-2 mt-4',
        4: 'text-lg font-medium text-gray-800 mb-2 mt-3',
      }
      htmlParts.push(`<${tag} class="${classes[level] || ''}">${text}</${tag}>`)
      continue
    }

    // Otherwise it's paragraph text
    if (!inParagraph) {
      htmlParts.push('<p class="text-gray-700 leading-relaxed mb-4">')
      inParagraph = true
    } else {
      htmlParts.push(' ')
    }
    htmlParts.push(inlineFormat(trimmed))
  }

  if (inParagraph) {
    htmlParts.push('</p>')
  }

  return htmlParts.join('')
}

function inlineFormat(text: string): string {
  // Bold: **text**
  let result = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Links: [text](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-blue-600 hover:underline" rel="noopener">$1</a>'
  )
  return result
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getBlogPost(params.slug)
  if (!post) return { title: 'Guide Not Found | NurseryMatch' }

  return {
    title: `${post.title} | NurseryMatch`,
    description: post.excerpt,
    alternates: { canonical: `/guides/${post.slug}` },
    openGraph: {
      title: `${post.title} | NurseryMatch`,
      description: post.excerpt,
      url: `/guides/${post.slug}`,
      siteName: 'NurseryMatch',
      type: 'article',
      locale: 'en_GB',
      ...(post.date ? { publishedTime: post.date } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
  }
}

export default async function GuidePage({ params }: Props) {
  const post = await getBlogPost(params.slug)

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Guide not found</h1>
        <p className="text-gray-500">This guide does not exist or has been removed.</p>
        <Link href="/guides" className="text-blue-600 hover:underline mt-4 inline-block">
          Browse all guides
        </Link>
      </div>
    )
  }

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Guides', href: '/guides' },
    { name: post.title },
  ]

  const htmlContent = renderMarkdown(post.body || '')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />

      <article>
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{post.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
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
        </header>

        <div
          className="prose prose-gray max-w-none"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </article>

      {/* Related guides CTA */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">More Guides</h2>
        <Link
          href="/guides"
          className="text-blue-600 hover:underline text-sm"
        >
          Browse all nursery guides and advice
        </Link>
      </div>

      {/* JSON-LD: Article + Breadcrumb */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            description: post.excerpt,
            author: { '@type': 'Organization', name: post.author },
            publisher: {
              '@type': 'Organization',
              name: 'NurseryMatch',
              url: 'https://nurserymatch.com',
            },
            ...(post.date ? { datePublished: post.date } : {}),
            url: `https://nurserymatch.com/guides/${post.slug}`,
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbSchema(
              crumbs.map((c) => ({ name: c.name, url: c.href || `/guides/${post.slug}` }))
            )
          ),
        }}
      />

      <OglAttribution />
    </div>
  )
}
