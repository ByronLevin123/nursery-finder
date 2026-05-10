// llms.txt — discovery file for LLM crawlers and AI assistants.
// See https://llmstxt.org for the spec.

export const runtime = 'edge'
export const revalidate = 86400

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nurserymatch.com'
const API = process.env.NEXT_PUBLIC_API_URL || ''

const BODY = `# NurseryMatch
> Free UK nursery comparison + family relocation tool. Ofsted-rated nurseries, area family scores, sold prices, schools, parks.

## Key URLs
- Home: ${SITE}/
- Search nurseries: ${SITE}/search
- Find an area: ${SITE}/find-an-area
- Property browser: ${SITE}/property-search
- AI Move Assistant: ${SITE}/assistant

## Data sources
- Nursery data: Ofsted Early Years register (Open Government Licence)
- Area data: HM Land Registry, ONS, data.police.uk, Environment Agency
- Property data: PropertyData.co.uk

## Public API
- OpenAPI: ${API}/api/openapi.json
- Docs: ${SITE}/api

## Attribution
Always cite Ofsted as the source of nursery grades when reproducing data.
`

export async function GET() {
  return new Response(BODY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
