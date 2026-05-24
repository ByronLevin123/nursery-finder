# NurseryMatch MCP Server

An MCP (Model Context Protocol) server that gives Claude Desktop full access to NurseryMatch — search 27,000+ UK nurseries, compare options, check areas, calculate commutes, and read guides.

## Setup

### 1. Install dependencies

```bash
cd mcp-server
npm install
```

### 2. Add to Claude Desktop

Open your Claude Desktop config file:

- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the NurseryMatch server:

```json
{
  "mcpServers": {
    "nurserymatch": {
      "command": "node",
      "args": ["/absolute/path/to/nursery-finder/mcp-server/index.js"]
    }
  }
}
```

### 3. Restart Claude Desktop

You should see a hammer icon with "20 tools" (or similar) in the Claude input area.

## Available Tools (20)

### Nursery Search & Discovery

| Tool | Description |
|------|-------------|
| `search_nurseries` | Search by postcode, place name, or nursery name. Filter by Ofsted grade, funded places, availability, rating, provider type. Returns up to 50 results. |
| `get_nursery` | Full details for a single nursery by URN: address, all Ofsted grades, fees, funded places, availability, reviews, contact info. |
| `compare_nurseries` | Side-by-side comparison of 2-10 nurseries on grades, fees, availability, and scores. |
| `autocomplete_nurseries` | Type-ahead nursery name search (min 2 chars). |
| `get_nurseries_in_town` | All nurseries in a town, sorted by Ofsted grade, with town-level stats. |
| `get_similar_nurseries` | Find similar nurseries within 3km of a given nursery. |
| `get_nursery_reviews` | Parent reviews for a nursery with ratings and text. |
| `get_nursery_availability` | Current availability by age group (baby, toddler, pre-school). |
| `get_school_progression` | School progression path: nursery → primary → secondary feeder schools. |

### Areas & Relocation

| Tool | Description |
|------|-------------|
| `get_area` | Area stats for a postcode district: family score, nursery quality breakdown, crime rate, parks, IMD deprivation, property prices by type. |
| `find_family_areas` | Find the best family-friendly areas near a postcode, ranked by family score. |
| `browse_districts` | Browse UK districts filtered by property price, type, region, and family score. |

### Travel & Schools

| Tool | Description |
|------|-------------|
| `calculate_travel_time` | Walking, cycling, or driving time between two points (postcodes, coordinates, or nursery URNs). |
| `find_schools_nearby` | Find primary and secondary schools near any coordinates. |

### Markdown Summaries (LLM-optimised)

| Tool | Description |
|------|-------------|
| `get_nursery_markdown` | Nursery profile as clean readable markdown — ideal for summarising to parents. |
| `get_area_markdown` | Area summary as markdown — family score, nursery quality, crime, property prices. |

### Guides & Advice

| Tool | Description |
|------|-------------|
| `list_guides` | List all nursery advice articles (title, excerpt, date, slug). |
| `get_guide` | Full guide article by slug (e.g. "how-to-choose-nursery"). |

### AI Features

| Tool | Description |
|------|-------------|
| `ai_nursery_summary` | AI-generated summary of a nursery based on Ofsted data, reviews, and profile. |
| `ai_review_synthesis` | AI synthesis of all parent reviews — themes, strengths, and concerns. |

## Example Conversations

Once set up, you can ask Claude things like:

- "Find Outstanding nurseries near SW11 with funded 3-year-old places"
- "Compare nurseries 123456 and 789012 — which is better for a 2-year-old?"
- "What's the family score for BS6? How does it compare to BS7 and BS8?"
- "How long would it take to walk from my home (E2 8DP) to nursery 654321?"
- "Show me the cheapest areas in London with great nurseries and low crime"
- "What do parents say about this nursery? Summarise the reviews."
- "What primary schools are near nursery 123456? What's the progression path?"
- "What free childcare hours am I entitled to? How do I apply?"

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `NURSERYMATCH_API_URL` | `https://nursery-finder-6u7r.onrender.com` | API base URL |

## Data Attribution

Nursery grades are sourced from Ofsted under the Open Government Licence. Always cite Ofsted when quoting grades.
