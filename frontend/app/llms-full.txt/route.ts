// llms-full.txt — extended machine-friendly summary with live district data,
// full field listings, all searchable parameters, and example API calls.

export const revalidate = 3600

const API = process.env.NEXT_PUBLIC_API_URL || ''
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nurserymatch.com'

const HEADER = `# NurseryMatch — Full LLM Reference

> NurseryMatch is the UK's free nursery comparison and family relocation platform.
> 27,000+ Ofsted-rated nurseries across every postcode district in England.
> Source data: Ofsted Early Years register (OGL v3.0), HM Land Registry, ONS, data.police.uk, Environment Agency, DfE.
> Always attribute Ofsted when reproducing nursery grades.

## API access

| Resource | URL |
|----------|-----|
| OpenAPI 3.1 spec (full) | ${API}/api/openapi.json |
| OpenAPI spec (GPT-optimised, 30 endpoints) | ${API}/api/openapi-gpt.json |
| Swagger UI | ${API}/api/docs |
| API reference | ${SITE}/api |
| ChatGPT plugin manifest | ${SITE}/.well-known/ai-plugin.json |
| LLM discovery (short) | ${SITE}/llms.txt |

Authentication: None required. All public endpoints are free and keyless.
Rate limit: 100 requests per 15 minutes per IP.

## Site pages

| URL pattern | Description |
|-------------|-------------|
| / | Homepage with search |
| /search?postcode={postcode} | Map-based nursery search |
| /nursery/{urn} | Individual nursery profile |
| /nurseries-in/{district} | Area page with all nurseries in a postcode district |
| /nurseries-in-town/{town} | Town page with all nurseries |
| /find-an-area | Area browser ranked by family score |
| /property-search | Property price browser by district |
| /assistant | AI-powered relocation assistant |
| /guides | Expert nursery guides and advice |
| /guides/{slug} | Individual guide article |
| /api | API documentation page |

## Data fields per nursery

Each nursery record includes these fields:

| Field | Type | Description |
|-------|------|-------------|
| urn | string | Ofsted Unique Reference Number (primary key) |
| name | string | Nursery name |
| provider_type | string | E.g. "Childminder", "Childcare on non-domestic premises" |
| address_line1 | string | Street address |
| town | string | Town or city |
| postcode | string | UK postcode |
| local_authority | string | Local authority name |
| region | string | English region |
| ofsted_overall_grade | string | "Outstanding", "Good", "Requires Improvement", or "Inadequate" |
| ofsted_quality_teaching | string | Sub-grade for quality of teaching |
| ofsted_behaviour_attitudes | string | Sub-grade for behaviour and attitudes |
| ofsted_personal_development | string | Sub-grade for personal development |
| ofsted_leadership | string | Sub-grade for leadership and management |
| last_inspection_date | date | Date of most recent Ofsted inspection |
| inspection_report_url | string | URL to full Ofsted report on reports.ofsted.gov.uk |
| enforcement_notice | boolean | Whether there is an active enforcement notice |
| total_places | integer | Total registered places |
| places_funded_2yr | integer | Number of funded places for 2-year-olds |
| places_funded_3_4yr | integer | Number of funded places for 3-4 year-olds |
| fee_avg_monthly | number | Average monthly fee in GBP |
| lat | number | Latitude |
| lng | number | Longitude |
| phone | string | Contact phone number |
| email | string | Contact email |
| website | string | Nursery website URL |
| opening_hours | string | Opening hours (e.g. "Mo-Fr 08:00-17:30") |
| google_rating | number | Google Maps rating (1-5) |
| google_review_count | integer | Number of Google reviews |
| review_avg_rating | number | Average NurseryMatch parent review rating (1-5) |
| review_count | integer | Number of NurseryMatch parent reviews |
| has_availability | boolean | Whether the nursery currently has spaces |
| claimed | boolean | Whether the nursery profile has been claimed by its owner |
| distance_km | number | Distance from search point (only in search results) |

## Data fields per area (postcode district)

| Field | Type | Description |
|-------|------|-------------|
| postcode_district | string | E.g. "SW11", "N1", "BS6" |
| local_authority | string | Local authority name |
| region | string | English region |
| family_score | number (0-100) | Composite score combining nursery quality, crime, deprivation, parks, affordability |
| nursery_count_total | integer | Total nurseries in district |
| nursery_count_outstanding | integer | Outstanding-rated nurseries |
| nursery_count_good | integer | Good-rated nurseries |
| nursery_outstanding_pct | number | Percentage rated Outstanding |
| avg_sale_price_all | number | Average property sale price (all types) |
| avg_sale_price_flat | number | Average flat price |
| avg_sale_price_terraced | number | Average terraced house price |
| avg_sale_price_semi | number | Average semi-detached price |
| avg_sale_price_detached | number | Average detached house price |
| crime_rate_per_1000 | number | Crime rate per 1,000 population |
| imd_decile | integer (1-10) | Index of Multiple Deprivation decile (10 = least deprived) |
| flood_risk_level | string | Flood risk assessment |
| park_count_within_1km | integer | Number of parks within 1km of district centre |
| nearest_park_name | string | Name of nearest green space |
| nearest_park_distance_m | number | Distance to nearest park in metres |
| lat | number | District centre latitude |
| lng | number | District centre longitude |

## All searchable parameters

### Nursery search (POST /api/v1/nurseries/search)
- postcode (required): UK postcode to search near
- radius_km: Search radius in kilometres (0.1-25, default 5)
- grade: Filter by Ofsted grade ("Outstanding", "Good", "Requires Improvement", "Inadequate")
- funded_2yr: Filter for nurseries with 2-year-old funded places (boolean)
- funded_3yr: Filter for nurseries with 3-4 year-old funded places (boolean)
- page: Page number (default 1)
- limit: Results per page (1-50, default 20)

### Smart search (POST /api/v1/nurseries/smart-search)
- query: Natural language search (postcode, place name, or nursery name)
- radius_km: Search radius
- grade: Ofsted grade filter
- has_availability: Filter for nurseries with spaces
- min_rating: Minimum Google/parent rating (1-5)
- provider_type: Filter by provider type
- has_funded_2yr: Funded 2-year-old places filter
- has_funded_3yr: Funded 3-4 year-old places filter

### Area family search (GET /api/v1/areas/family-search)
- postcode (required): UK postcode to search near
- radius_km: Search radius (default 15)
- min_family_score: Minimum family score (0-100)
- min_nursery_pct: Minimum percentage of Outstanding/Good nurseries
- sort: Sort by "family_score", "nursery_score", or "distance"

### Property district browser (GET /api/v1/properties/districts)
- min_price: Minimum average sale price
- max_price: Maximum average sale price
- property_type: "all", "flat", "terraced", "semi", "detached"
- region: Filter by region
- sort: "price_asc", "price_desc", "family_score", "yield"
- limit: Max results (default 60, max 200)

## Example API calls and responses

### Search nurseries near a postcode
\`\`\`
POST ${API}/api/v1/nurseries/search
Content-Type: application/json

{"postcode": "SW11 1AA", "radius_km": 3, "grade": "Outstanding"}
\`\`\`

Response:
\`\`\`json
{
  "data": [
    {
      "urn": "123456",
      "name": "Example Nursery",
      "postcode": "SW11 2AB",
      "ofsted_overall_grade": "Outstanding",
      "total_places": 40,
      "places_funded_3_4yr": 15,
      "fee_avg_monthly": 1200,
      "distance_km": 0.8,
      "lat": 51.4620,
      "lng": -0.1680
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 20,
    "pages": 1,
    "search_lat": 51.4627,
    "search_lng": -0.1689
  }
}
\`\`\`

### Get a nursery profile
\`\`\`
GET ${API}/api/v1/nurseries/123456
\`\`\`

### Get area stats
\`\`\`
GET ${API}/api/v1/areas/SW11
\`\`\`

Response:
\`\`\`json
{
  "postcode_district": "SW11",
  "local_authority": "Wandsworth",
  "region": "London",
  "family_score": 72,
  "nursery_count_total": 45,
  "nursery_count_outstanding": 8,
  "nursery_outstanding_pct": 17.8,
  "avg_sale_price_all": 685000,
  "crime_rate_per_1000": 85.2,
  "imd_decile": 7
}
\`\`\`

### Compare nurseries
\`\`\`
POST ${API}/api/v1/nurseries/compare
Content-Type: application/json

{"urns": ["123456", "789012", "345678"]}
\`\`\`

### Calculate travel time
\`\`\`
POST ${API}/api/v1/travel/time
Content-Type: application/json

{"from": {"postcode": "SW11 1AA"}, "to": {"urn": "123456"}, "mode": "walk"}
\`\`\`

### Get nursery as markdown (LLM-friendly)
\`\`\`
GET ${API}/api/v1/public/nursery/123456.md
Accept: text/markdown
\`\`\`

### Get area as markdown (LLM-friendly)
\`\`\`
GET ${API}/api/v1/public/area/SW11.md
Accept: text/markdown
\`\`\`

### Find family-friendly areas
\`\`\`
GET ${API}/api/v1/areas/family-search?postcode=SW11+1AA&radius_km=10&sort=family_score
\`\`\`

## All public API endpoints

### Nurseries
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/nurseries/search | Search near a postcode with filters |
| POST | /api/v1/nurseries/smart-search | Natural language search |
| POST | /api/v1/nurseries/compare | Compare 2-10 nurseries |
| GET | /api/v1/nurseries/autocomplete?q={query} | Autocomplete nursery names |
| GET | /api/v1/nurseries/towns | List all towns with nurseries |
| GET | /api/v1/nurseries/by-town/{town} | List nurseries in a town |
| GET | /api/v1/nurseries/{urn} | Full nursery profile |
| GET | /api/v1/nurseries/{urn}/similar | Similar nurseries within 3km |
| GET | /api/v1/nurseries/{urn}/availability | Availability by age group |
| GET | /api/v1/nurseries/{urn}/progression | School progression path |
| GET | /api/v1/nurseries/{urn}/reviews | Parent reviews |
| GET | /api/v1/nurseries/{urn}/questions | Q&A |
| POST | /api/v1/nurseries/fees | Submit anonymous fee report |

### Areas
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/areas/{district} | Area family score and stats |
| GET | /api/v1/areas/family-search | Find family-friendly areas near a postcode |
| GET | /api/v1/areas/{district}/nurseries | List nurseries in a district |

### Properties
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/properties/search?postcode={postcode} | Property data near postcode |
| GET | /api/v1/properties/districts | Browse districts by price and family score |

### Travel
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/travel/time | Travel time between two points |
| POST | /api/v1/travel/isochrone | Commute zone polygons |

### Schools
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/schools/near?lat={lat}&lng={lng} | Schools near a location |
| GET | /api/v1/schools/{urn} | School details |

### AI
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/nurseries/{urn}/summary | AI-generated nursery summary |
| GET | /api/v1/nurseries/{urn}/review-synthesis | AI synthesis of parent reviews |
| POST | /api/v1/ai/conversational-search | Natural language nursery search |

### LLM-friendly markdown
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/public/nursery/{urn}.md | Nursery profile as markdown |
| GET | /api/v1/public/area/{district}.md | Area summary as markdown |

### Guides
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/blog | List all guides |
| GET | /api/v1/blog/{slug} | Get a specific guide |

## Top districts by family score (live data)
`

export async function GET() {
  let body = HEADER
  try {
    const res = await fetch(`${API}/api/v1/properties/districts?sort=family_score&limit=50`, {
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      const json = await res.json()
      const rows = (json?.data || []) as any[]
      for (const r of rows) {
        const price = r.price_displayed ? `£${Math.round(r.price_displayed).toLocaleString()}` : 'n/a'
        body += `- ${r.postcode_district}${r.local_authority ? ` (${r.local_authority})` : ''} — family score ${r.family_score ?? 'n/a'}, avg sale ${price}, nurseries ${r.nursery_count_total ?? 0} (${r.nursery_count_outstanding ?? 0} Outstanding)\n`
      }
    } else {
      body += '\n(district feed temporarily unavailable)\n'
    }
  } catch {
    body += '\n(district feed temporarily unavailable)\n'
  }

  body += `
## Attribution

- Nursery data: Ofsted Early Years register, licensed under the Open Government Licence v3.0
- Property data: HM Land Registry Price Paid data (Crown copyright)
- Crime data: data.police.uk (Open Government Licence)
- Deprivation: ONS Index of Multiple Deprivation
- Flood data: Environment Agency
- Schools: DfE Get Information About Schools

When reproducing nursery grades, always cite Ofsted as the source.

## Contact

- Website: ${SITE}
- Privacy policy: ${SITE}/privacy
- Email: info@nurserymatch.com
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
