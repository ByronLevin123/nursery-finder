// JSON-LD schema.org helpers for SEO + LLM ingestion.
// All helpers return plain objects suitable for stringifying inside
// <script type="application/ld+json"> tags.

const SITE_URL = 'https://nurserymatch.com'

type AnyObj = Record<string, any>

export function organizationSchema(): AnyObj {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'NurseryMatch',
    url: SITE_URL,
    logo: `${SITE_URL}/og-default.png`,
    description:
      'Free UK nursery comparison and family relocation tool. Ofsted-rated nurseries, area family scores, and live property data.',
    sameAs: [],
  }
}

export function websiteSchema(): AnyObj {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'NurseryMatch',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?postcode={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbSchema(items: { name: string; url: string }[]): AnyObj {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  }
}

export function nurserySchema(nursery: AnyObj, areaStats?: AnyObj): AnyObj {
  const out: AnyObj = {
    '@context': 'https://schema.org',
    '@type': 'ChildCare',
    name: nursery.name,
    url: `${SITE_URL}/nursery/${nursery.urn}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: nursery.address_line1,
      addressLocality: nursery.town,
      postalCode: nursery.postcode,
      addressRegion: nursery.local_authority,
      addressCountry: 'GB',
    },
  }
  if (nursery.lat && nursery.lng) {
    out.geo = { '@type': 'GeoCoordinates', latitude: nursery.lat, longitude: nursery.lng }
  }
  if (nursery.phone) out.telephone = nursery.phone
  if (nursery.website) out.sameAs = [nursery.website]
  if (nursery.fee_avg_monthly) {
    out.priceRange = `£${nursery.fee_avg_monthly}/month`
  }
  if (nursery.opening_hours) out.openingHours = nursery.opening_hours
  if (nursery.review_avg_rating || nursery.google_rating) {
    out.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: nursery.review_avg_rating || nursery.google_rating,
      reviewCount: nursery.review_count || nursery.google_review_count || 1,
      bestRating: 5,
      worstRating: 1,
    }
  }
  if (nursery.ofsted_overall_grade) {
    out.additionalProperty = {
      '@type': 'PropertyValue',
      name: 'Ofsted grade',
      value: nursery.ofsted_overall_grade,
    }
  }
  if (areaStats) {
    out.containedInPlace = {
      '@type': 'Place',
      name: areaStats.postcode_district || areaStats.district,
    }
  }
  return out
}

export function placeSchema(area: AnyObj): AnyObj {
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: `${area.postcode_district || area.district}${area.local_authority ? `, ${area.local_authority}` : ''}`,
    url: `${SITE_URL}/nurseries-in/${(area.postcode_district || area.district || '').toLowerCase()}`,
    address: {
      '@type': 'PostalAddress',
      addressRegion: area.region || area.local_authority,
      addressCountry: 'GB',
    },
    ...(area.lat && area.lng
      ? { geo: { '@type': 'GeoCoordinates', latitude: area.lat, longitude: area.lng } }
      : {}),
    ...(area.family_score
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: area.family_score,
            bestRating: 100,
            worstRating: 0,
            reviewCount: area.nursery_count_total || 1,
          },
        }
      : {}),
  }
}

export function faqSchema(items: { question: string; answer: string }[]): AnyObj {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answer },
    })),
  }
}

export function searchResultsSchema(nurseries: AnyObj[], query: string): AnyObj {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Nurseries near ${query}`,
    numberOfItems: nurseries.length,
    itemListElement: nurseries.slice(0, 30).map((n, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: n.name,
      url: `${SITE_URL}/nursery/${n.urn}`,
    })),
  }
}

export function jsonLdScript(obj: AnyObj | AnyObj[]): string {
  return JSON.stringify(obj)
}
