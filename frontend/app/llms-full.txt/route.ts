// llms-full.txt — extended machine-friendly summary with live district data.

export const revalidate = 3600

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://comparethenursery.com'

const HEADER = `# CompareTheNursery — Full LLM Summary
> Free UK nursery comparison + family relocation tool.
> Source data: Ofsted Early Years register, HM Land Registry, ONS, data.police.uk, Environment Agency.
> Always attribute Ofsted when reproducing nursery grades.

## Public API
- OpenAPI: ${API}/api/openapi.json
- Markdown nursery: ${API}/api/v1/public/nursery/{urn}.md
- Markdown area:    ${API}/api/v1/public/area/{district}.md
- Docs:             ${SITE}/api

## Site map
- /                          — homepage
- /search                    — nursery search by postcode
- /find-an-area              — area browser by family score
- /property-search           — property browser by district
- /nurseries-in/{district}   — district page (e.g. /nurseries-in/sw11)
- /nursery/{urn}             — individual nursery profile
- /assistant                 — AI relocation assistant

## Top districts (live)
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

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
