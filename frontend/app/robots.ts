import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const allowedBots = [
    'Googlebot',
    'Bingbot',
    'GPTBot',
    'ClaudeBot',
    'Claude-Web',
    'PerplexityBot',
    'CCBot',
    'Google-Extended',
    'Applebot',
    'anthropic-ai',
  ]

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/provider/*/edit', '/api/', '/account', '/login', '/shortlist'],
      },
      ...allowedBots.map((bot) => ({
        userAgent: bot,
        allow: '/',
        disallow: ['/admin', '/provider/*/edit', '/account'],
      })),
    ],
    sitemap: 'https://nursery-finder.vercel.app/sitemap.xml',
    host: 'https://nursery-finder.vercel.app',
  }
}
