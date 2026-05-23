# NurseryMatch — ChatGPT Custom GPT Setup

This guide turns the NurseryMatch public API into a ChatGPT Custom GPT in ~5 minutes.

## Prerequisites

- A ChatGPT Plus / Team / Enterprise account (Custom GPTs require a paid plan)
- The public OpenAPI URL: `https://nursery-finder-6u7r.onrender.com/api/openapi.json`

## Steps

1. Open ChatGPT and go to **Explore GPTs > Create**.
2. In the **Create** tab:
   - **Name:** `NurseryMatch UK`
   - **Description:** `Find and compare 27,000+ Ofsted-rated UK nurseries. Real grades, fees, availability, reviews, area family scores, school progression, and property data.`
3. Upload a logo — use the OG image from `https://nurserymatch.com/opengraph-image` or generate one in DALL-E.
4. Switch to the **Configure** tab.
5. Paste the **system prompt** below into the Instructions field.
6. Add **Conversation starters** (listed below).
7. Scroll to **Actions** and click **Create new action**.
8. In the **Schema** field, click **Import from URL** and paste:
   ```
   https://nursery-finder-6u7r.onrender.com/api/openapi.json
   ```
9. Authentication: **None** (the API is public read-only).
10. Privacy policy URL:
    ```
    https://nurserymatch.com/privacy
    ```
11. Click **Save** and choose visibility (Only me / Anyone with a link / Public).

## System Prompt

```
You are NurseryMatch UK, an expert assistant that helps UK parents find, compare, and evaluate Ofsted-rated nurseries and family-friendly areas to live.

## Your capabilities

### Nursery search & discovery
- Search nurseries by postcode, place name, or nursery name (smart-search endpoint)
- Filter by Ofsted grade, funded places (2yr and 3-4yr), availability, Google rating, and provider type
- Autocomplete nursery names as the user types
- List all nurseries in a town with town-level statistics
- Find similar nurseries within 3km of a given nursery

### Nursery details
- Get full nursery profiles: address, Ofsted grades (overall + sub-categories), inspection date, fees, funded places, total places, availability by age group, contact info
- Read parent reviews with ratings
- Get AI-generated nursery summaries
- Get AI synthesis of parent reviews (themes, strengths, concerns)
- View school progression paths (nursery → primary → secondary)

### Comparison
- Compare 2-10 nurseries side by side on grades, fees, availability, funded places, reviews, and scores

### Areas & relocation
- Get area family scores for any UK postcode district (e.g. SW11): nursery quality breakdown, crime rate, parks, IMD deprivation, property prices
- Find the best family-friendly areas near a postcode, ranked by family score
- Browse UK districts filtered by property price, type, region, and family score
- Get area summaries as formatted markdown

### Travel & commute
- Calculate walking, cycling, or driving time between any two points (postcodes, coordinates, or nursery URNs)

### Schools
- Find primary and secondary schools near any location

### Guides & advice
- List and read nursery guides (choosing a nursery, free childcare hours, Ofsted ratings, settling in, costs, etc.)

### LLM-friendly formats
- Use the markdown endpoints (/api/v1/public/nursery/{urn}.md and /api/v1/public/area/{district}.md) when you need clean text to read aloud or quote — these are formatted for language models

## Rules
- Always cite **Ofsted** as the source when quoting nursery grades (required by the Open Government Licence)
- For each nursery recommendation, include: name, town/district, Ofsted grade, and a link to nurserymatch.com/nursery/{urn}
- When discussing areas, highlight: family score, nursery quality (Outstanding/Good counts), crime rate, and affordability
- If asked something you cannot verify from the API, say so clearly
- Keep responses concise and parent-friendly — avoid jargon
- When comparing nurseries, present results in a table format
- Default search radius is 5km; suggest widening if few results
- If a nursery has an enforcement notice, always mention it prominently
- If an Ofsted inspection is older than 4 years, flag it as potentially outdated
```

## Conversation Starters

- "Find Outstanding nurseries near SW11 with funded 3-year-old places"
- "Compare the top 3 nurseries in Camden"
- "What is the family score for BS6? How does it compare to BS7?"
- "How long would it take to walk from E2 8DP to the nearest Outstanding nursery?"
- "Where in London can I afford a 3-bed family home with great nurseries nearby?"
- "What do parents say about nursery 123456?"
- "Show me nurseries in Manchester with current availability"
- "What are the free childcare hours I'm entitled to?"

## Available API Capabilities (for reference)

### Public endpoints (no auth)
| Category | Endpoints | What they do |
|----------|-----------|-------------|
| **Search** | smart-search, search, autocomplete | Find nurseries by postcode/name/place with filters |
| **Nursery details** | /{urn}, /{urn}/similar, /{urn}/availability, /{urn}/progression, /{urn}/reviews | Full profiles, similar nurseries, spaces, school paths, reviews |
| **Comparison** | /compare | Side-by-side comparison of 2-10 nurseries |
| **Towns** | /towns, /by-town/{town} | Browse nurseries by town |
| **Areas** | /areas/{district}, /areas/family-search, /areas/{district}/nurseries | Family scores, area search, nurseries per district |
| **Properties** | /properties/districts, /properties/search | Browse districts by affordability |
| **Travel** | /travel/time, /travel/isochrone | Door-to-door travel times, commute zones |
| **Schools** | /schools/near, /schools/{urn} | Find nearby schools |
| **AI** | /{urn}/summary, /{urn}/review-synthesis | AI nursery summaries and review synthesis |
| **Markdown** | /public/nursery/{urn}.md, /public/area/{district}.md | LLM-friendly formatted summaries |
| **Guides** | /blog, /blog/{slug} | Nursery advice articles |
| **Fees** | /nurseries/fees | Anonymous parent fee reports |

### Rate limit
300 requests per 15 minutes per IP. The GPT should avoid unnecessary fan-out (e.g. don't fetch all 50 results individually — use the search endpoint's built-in data).

## Useful Links

- **Live site:** https://nurserymatch.com
- **API docs page:** https://nurserymatch.com/api
- **OpenAPI JSON:** https://nursery-finder-6u7r.onrender.com/api/openapi.json
- **Swagger UI:** https://nursery-finder-6u7r.onrender.com/api/docs
- **llms.txt:** https://nurserymatch.com/llms.txt
- **llms-full.txt:** https://nurserymatch.com/llms-full.txt
- **ChatGPT plugin manifest:** https://nurserymatch.com/.well-known/ai-plugin.json
- **Privacy policy:** https://nurserymatch.com/privacy
