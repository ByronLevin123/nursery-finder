import { MetadataRoute } from 'next'

const SITE_URL = 'https://comparethenursery.com'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nursery-finder-6u7r.onrender.com'

export const revalidate = 86400 // regenerate at most once per day

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,             changeFrequency: 'daily',   priority: 1 },
    { url: `${SITE_URL}/search`,       changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE_URL}/find-an-area`, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${SITE_URL}/compare`,      changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/privacy`,      changeFrequency: 'yearly',  priority: 0.2 },
  ]

  let nurseryEntries: MetadataRoute.Sitemap = []
  let districtEntries: MetadataRoute.Sitemap = []

  try {
    const [nurseriesRes, districtsRes] = await Promise.all([
      fetch(`${API_URL}/api/v1/sitemap/nurseries`, { next: { revalidate: 86400 } }),
      fetch(`${API_URL}/api/v1/sitemap/districts`, { next: { revalidate: 86400 } }),
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
  } catch {
    // fall back to static-only sitemap if backend is down
  }

  return [...staticEntries, ...districtEntries, ...nurseryEntries]
}
