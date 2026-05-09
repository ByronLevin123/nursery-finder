import { MetadataRoute } from 'next'
import { API_URL } from '@/lib/api'

const SITE_URL = 'https://nurserymatch.com'

export const revalidate = 86400 // regenerate at most once per day

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,             changeFrequency: 'daily',   priority: 1 },
    { url: `${SITE_URL}/search`,       changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE_URL}/find-an-area`, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${SITE_URL}/compare`,      changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/about`,        changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/faq`,          changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`,      changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/privacy`,      changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${SITE_URL}/terms`,        changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${SITE_URL}/refund`,       changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${SITE_URL}/dmca`,         changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${SITE_URL}/press`,        changeFrequency: 'monthly', priority: 0.3 },
  ]

  let nurseryEntries: MetadataRoute.Sitemap = []
  let districtEntries: MetadataRoute.Sitemap = []
  let townEntries: MetadataRoute.Sitemap = []
  let blogEntries: MetadataRoute.Sitemap = []

  try {
    const [nurseriesRes, districtsRes, townsRes, blogRes] = await Promise.all([
      fetch(`${API_URL}/api/v1/sitemap/nurseries`, { next: { revalidate: 86400 } }),
      fetch(`${API_URL}/api/v1/sitemap/districts`, { next: { revalidate: 86400 } }),
      fetch(`${API_URL}/api/v1/sitemap/towns`, { next: { revalidate: 86400 } }),
      fetch(`${API_URL}/api/v1/sitemap/blog`, { next: { revalidate: 86400 } }),
    ])

    if (nurseriesRes.ok) {
      const { urns } = await nurseriesRes.json()
      nurseryEntries = (urns || []).map((urn: string) => ({
        url: `${SITE_URL}/nursery/${urn}`,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }))
    }

    if (districtsRes.ok) {
      const { districts } = await districtsRes.json()
      districtEntries = (districts || []).map((d: string) => ({
        url: `${SITE_URL}/nurseries-in/${d.toLowerCase()}`,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))
    }

    if (townsRes.ok) {
      const { towns } = await townsRes.json()
      townEntries = (towns || []).map((t: string) => ({
        url: `${SITE_URL}/nurseries-in-town/${encodeURIComponent(t.toLowerCase())}`,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))
    }

    if (blogRes.ok) {
      const { slugs } = await blogRes.json()
      blogEntries = (slugs || []).map((slug: string) => ({
        url: `${SITE_URL}/guides/${slug}`,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }))
    }
  } catch {
    // fall back to static-only sitemap if backend is down
  }

  return [
    ...staticEntries,
    { url: `${SITE_URL}/nurseries-in-town`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${SITE_URL}/guides`, changeFrequency: 'weekly' as const, priority: 0.7 },
    ...districtEntries,
    ...townEntries,
    ...blogEntries,
    ...nurseryEntries,
  ]
}
