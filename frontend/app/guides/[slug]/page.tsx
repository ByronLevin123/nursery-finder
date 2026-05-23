import { Metadata } from 'next'
import { getBlogPost, getBlogPosts } from '@/lib/api'
import Breadcrumbs from '@/components/Breadcrumbs'
import Link from 'next/link'
import OglAttribution from '@/components/OglAttribution'
import { breadcrumbSchema, howToSchema, jsonLdScript } from '@/lib/schema'

const HOWTO_STEPS: Record<string, { steps: { name: string; text: string }[]; totalTime?: string }> = {
  'free-childcare-hours-guide': {
    totalTime: 'PT30M',
    steps: [
      { name: 'Check your eligibility', text: 'Visit the GOV.UK Childcare Choices website to check whether you qualify for 15 or 30 funded hours based on your working status and income.' },
      { name: 'Create a Childcare Service account', text: 'Sign up at the government Childcare Service portal using your National Insurance number, details of your employer, and your child\'s date of birth.' },
      { name: 'Apply for your code', text: 'Submit your application through the portal. You will receive an eligibility code, usually within a few days. This code is valid for the current term.' },
      { name: 'Share your code with your nursery', text: 'Give the eligibility code to your chosen nursery or childcare provider. They will validate it with the local authority to activate your funded hours.' },
      { name: 'Reconfirm every three months', text: 'Log back in to the Childcare Service every 3 months to reconfirm your eligibility. If you miss the deadline, you may lose your funded hours for the following term.' },
    ],
  },
  'how-to-choose-nursery': {
    steps: [
      { name: 'Start with Ofsted ratings', text: 'Check the nursery\'s Ofsted grade and read the full inspection report. Look beyond the headline rating at specific areas like safeguarding, learning environment, and staff qualifications.' },
      { name: 'Visit in person', text: 'Book a visit during a normal session so you can see how staff interact with children, how the space is used, and how routines like meals and nap time work.' },
      { name: 'Ask the right questions', text: 'Prepare a list of questions covering staff-to-child ratios, meal policies, nappy changing procedures, outdoor play frequency, and how they handle settling-in periods.' },
      { name: 'Consider practicalities', text: 'Think about your commute, opening hours, flexibility for pick-up and drop-off times, and whether the location works for your daily routine.' },
      { name: 'Check for funded places', text: 'Ask whether the nursery accepts government-funded hours (15 or 30 hours), Tax-Free Childcare, and whether there are any additional charges on top of funded sessions.' },
      { name: 'Look at the setting', text: 'Assess the indoor and outdoor spaces. Check they are clean, safe, age-appropriate, and stimulating. Look for evidence of planned activities and child-led learning.' },
      { name: 'Talk to other parents', text: 'Ask the nursery if you can speak to current parents. Online reviews on Google or NurseryMatch can also give you a sense of parent satisfaction.' },
      { name: 'Make your decision', text: 'Weigh up all factors including quality, cost, location, and gut feeling. Use NurseryMatch\'s comparison tool to compare your shortlisted nurseries side by side.' },
    ],
  },
}

export const dynamic = 'force-dynamic'

interface Props {
  params: { slug: string }
}

async function RelatedGuides({
  currentSlug,
  currentTags,
}: {
  currentSlug: string
  currentTags?: string[]
}) {
  let allPosts: import('@/lib/api').BlogPost[] = []
  try {
    allPosts = await getBlogPosts()
  } catch {
    return null
  }

  if (allPosts.length === 0) return null

  const others = allPosts.filter((p) => p.slug !== currentSlug)
  if (others.length === 0) return null

  let related: import('@/lib/api').BlogPost[]

  // If current post has tags, find posts that share tags
  if (currentTags && currentTags.length > 0) {
    const scored = others.map((p) => {
      const postTags = (p as any).tags as string[] | undefined
      if (!postTags || postTags.length === 0) return { post: p, overlap: 0 }
      const overlap = currentTags.filter((t) => postTags.includes(t)).length
      return { post: p, overlap }
    })
    scored.sort((a, b) => b.overlap - a.overlap)

    // If top results have tag overlap, use them; otherwise fall back to most recent
    if (scored[0]?.overlap > 0) {
      related = scored.slice(0, 3).map((s) => s.post)
    } else {
      related = others.slice(0, 3)
    }
  } else {
    // No tags on current post — show 3 most recent
    related = others.slice(0, 3)
  }

  if (related.length === 0) return null

  return (
    <div className="mt-12 pt-8 border-t border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">You might also like</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {related.map((rp) => (
          <Link
            key={rp.slug}
            href={`/guides/${rp.slug}`}
            className="block p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-indigo-200 transition"
          >
            <h3 className="font-medium text-gray-900 text-sm mb-2 line-clamp-2">
              {rp.title}
            </h3>
            <p className="text-xs text-gray-500 line-clamp-3">{rp.excerpt}</p>
          </Link>
        ))}
      </div>
    </div>
  )
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
    (_match: string, text: string, url: string) => {
      if (!/^(https?:\/\/|\/(?!\/)|mailto:)/.test(url)) return text
      return `<a href="${url}" class="text-blue-600 hover:underline" rel="noopener">${text}</a>`
    }
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
      images: [{ url: '/og-default.png', width: 1200, height: 630, alt: post.title }],
      ...(post.date ? { publishedTime: post.date } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: ['/og-default.png'],
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

      {/* Related guides */}
      <RelatedGuides currentSlug={post.slug} currentTags={(post as any).tags} />

      {/* All guides CTA */}
      <div className="mt-8 text-center">
        <Link
          href="/guides"
          className="text-blue-600 hover:underline text-sm"
        >
          Browse all nursery guides and advice
        </Link>
      </div>

      {/* JSON-LD: HowTo (for step-by-step guides) */}
      {HOWTO_STEPS[post.slug] && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(
              howToSchema({
                title: post.title,
                description: post.excerpt,
                slug: post.slug,
                date: post.date,
                ...HOWTO_STEPS[post.slug],
              })
            ),
          }}
        />
      )}

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
