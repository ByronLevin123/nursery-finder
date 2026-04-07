// llms.txt — discovery file for LLM crawlers and AI assistants.
// See https://llmstxt.org for the spec.

export const runtime = 'edge'
export const revalidate = 86400

const BODY = `# NurseryFinder
> Free UK nursery comparison + family relocation tool. Ofsted-rated nurseries, area family scores, sold prices, schools, parks.

## Key URLs
- Home: https://nursery-finder.vercel.app/
- Search nurseries: https://nursery-finder.vercel.app/search
- Find an area: https://nursery-finder.vercel.app/find-an-area
- Property browser: https://nursery-finder.vercel.app/property-search
- AI Move Assistant: https://nursery-finder.vercel.app/assistant

## Data sources
- Nursery data: Ofsted Early Years register (Open Government Licence)
- Area data: HM Land Registry, ONS, data.police.uk, Environment Agency
- Property data: PropertyData.co.uk

## Public API
- OpenAPI: https://nursery-finder-6u7r.onrender.com/api/openapi.json
- Docs: https://nursery-finder.vercel.app/api

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
