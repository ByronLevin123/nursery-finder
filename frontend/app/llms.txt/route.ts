// llms.txt — discovery file for LLM crawlers and AI assistants.
// See https://llmstxt.org for the spec.

export const runtime = 'edge'
export const revalidate = 86400

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nurserymatch.com'
const API = process.env.NEXT_PUBLIC_API_URL || ''

const BODY = `# NurseryMatch

> NurseryMatch is the UK's free nursery comparison and family relocation platform. It covers 27,000+ Ofsted-rated nurseries across every postcode district in England, with area intelligence including family scores, crime rates, school data, and property prices.

## What NurseryMatch offers

- **Nursery search**: Search by postcode, place name, or nursery name with filters for Ofsted grade, funded places, availability, provider type, and Google rating
- **Nursery profiles**: Full details for each nursery including Ofsted grades (overall + sub-categories), inspection dates, fees, funded places, total places, availability by age group, parent reviews, and contact info
- **Nursery comparison**: Side-by-side comparison of up to 10 nurseries on grades, fees, availability, funded places, reviews, and match scores
- **Area intelligence**: Family scores (0-100) for every UK postcode district combining nursery quality, crime rate, deprivation, parks, and affordability
- **Property data**: Average sold prices by district from HM Land Registry, filterable by property type
- **School data**: Primary and secondary schools near any location, with Ofsted grades and nursery-to-school progression paths
- **Travel times**: Walking, cycling, and driving times between any two UK points
- **Parent reviews**: Anonymous, moderated parent reviews with AI-generated synthesis of themes
- **Guides**: Expert articles on choosing nurseries, free childcare hours, Ofsted ratings, costs, and settling in

## Coverage

- 27,000+ active nurseries from the Ofsted Early Years register
- Every postcode district in England with family scores
- Property price data from HM Land Registry
- Crime data from data.police.uk
- School data from the DfE Get Information About Schools register

## Example questions this data can answer

- "What are the best nurseries near SW11?"
- "Find Outstanding nurseries in Manchester with funded 3-year-old places"
- "Compare nursery fees in Bristol vs Leeds"
- "Which areas near Cambridge have the highest family scores?"
- "What do parents say about nursery 123456?"
- "How long does it take to walk from E2 8DP to the nearest Outstanding nursery?"
- "Where in London can I afford a 3-bed family home with great nurseries nearby?"
- "What are the Ofsted grades for nurseries in N16?"
- "Show me nurseries with current availability in Brighton"

## Key URLs

- Website: ${SITE}
- Search nurseries: ${SITE}/search
- Browse by area: ${SITE}/find-an-area
- Property browser: ${SITE}/property-search
- AI Move Assistant: ${SITE}/assistant
- Guides: ${SITE}/guides

## API for LLMs and agents

NurseryMatch provides a free, public, read-only JSON API. No API key required.

- OpenAPI 3.1 spec: ${API}/api/openapi.json
- GPT-optimised spec (30 endpoints): ${API}/api/openapi-gpt.json
- Interactive docs (Swagger UI): ${API}/api/docs
- API reference page: ${SITE}/api

### Key API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/v1/nurseries/smart-search | POST | Search by postcode, place name, or nursery name with filters |
| /api/v1/nurseries/{urn} | GET | Full nursery profile by Ofsted URN |
| /api/v1/nurseries/compare | POST | Compare 2-10 nurseries side by side |
| /api/v1/nurseries/{urn}/reviews | GET | Parent reviews for a nursery |
| /api/v1/areas/{district} | GET | Area family score and stats for a postcode district |
| /api/v1/areas/family-search | GET | Find family-friendly areas near a postcode |
| /api/v1/travel/time | POST | Calculate travel time between two points |
| /api/v1/public/nursery/{urn}.md | GET | Nursery profile as markdown (LLM-friendly) |
| /api/v1/public/area/{district}.md | GET | Area summary as markdown (LLM-friendly) |
| /api/v1/blog | GET | List nursery guides and advice articles |

### LLM-friendly markdown endpoints

For cleaner text output suitable for reading aloud or quoting, use the markdown endpoints:
- \`GET ${API}/api/v1/public/nursery/{urn}.md\` — returns a nursery profile as formatted markdown
- \`GET ${API}/api/v1/public/area/{district}.md\` — returns an area summary as formatted markdown

## ChatGPT Custom GPT

A dedicated NurseryMatch GPT is available for ChatGPT Plus users:
https://chat.openai.com/g/g-nurserymatch

ChatGPT plugin manifest: ${SITE}/.well-known/ai-plugin.json

## Data sources and attribution

- Nursery data: Ofsted Early Years register (Open Government Licence v3.0). Always cite Ofsted as the source when reproducing nursery grades.
- Property data: HM Land Registry Price Paid data
- Crime data: data.police.uk
- Deprivation data: ONS Index of Multiple Deprivation
- Flood data: Environment Agency
- Schools: DfE Get Information About Schools

## Extended information

For full data field listings, all searchable parameters, and example API responses, see:
${SITE}/llms-full.txt
`

export async function GET() {
  return new Response(BODY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
