// llms.txt — discovery file for LLM crawlers and AI assistants.
// See https://llmstxt.org for the spec.

export const runtime = 'edge'
export const revalidate = 86400

const BODY = `# CompareTheNursery
> Free UK nursery comparison + family relocation tool. Ofsted-rated nurseries, area family scores, sold prices, schools, parks.

## Key URLs
- Home: https://comparethenursery.com/
- Search nurseries: https://comparethenursery.com/search
- Find an area: https://comparethenursery.com/find-an-area
- Property browser: https://comparethenursery.com/property-search
- AI Move Assistant: https://comparethenursery.com/assistant

## Data sources
- Nursery data: Ofsted Early Years register (Open Government Licence)
- Area data: HM Land Registry, ONS, data.police.uk, Environment Agency
- Property data: PropertyData.co.uk

## Public API
- OpenAPI: https://nursery-finder-6u7r.onrender.com/api/openapi.json
- Docs: https://comparethenursery.com/api

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
