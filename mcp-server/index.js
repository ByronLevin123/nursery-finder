#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const API_BASE =
  process.env.NURSERYMATCH_API_URL ||
  'https://nursery-finder-6u7r.onrender.com'

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`)
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('json') ? res.json() : res.text()
}

const server = new McpServer({
  name: 'nurserymatch',
  version: '1.0.0',
})

server.tool(
  'search_nurseries',
  'Search UK nurseries by postcode, place name, or nursery name. Returns up to 50 results with Ofsted grade, distance, and key details.',
  {
    query: z.string().describe('Postcode (e.g. "SW11 1AA"), place name (e.g. "Camden"), or nursery name'),
    radius_km: z.number().min(0.1).max(25).optional().describe('Search radius in km (default 5)'),
    grade: z.enum(['Outstanding', 'Good', 'Requires Improvement', 'Inadequate']).optional().describe('Filter by Ofsted grade'),
    has_funded_2yr: z.boolean().optional().describe('Only nurseries with funded 2-year-old places'),
    has_funded_3yr: z.boolean().optional().describe('Only nurseries with funded 3-4-year-old places'),
  },
  async ({ query, radius_km, grade, has_funded_2yr, has_funded_3yr }) => {
    const body = { query, radius_km, grade }
    if (has_funded_2yr) body.funded_2yr = true
    if (has_funded_3yr) body.funded_3yr = true
    const data = await apiFetch('/api/v1/nurseries/smart-search', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    }
  }
)

server.tool(
  'get_nursery',
  'Get full details for a single nursery by its Ofsted URN. Includes address, grades, fees, availability, and reviews.',
  {
    urn: z.string().describe('Ofsted URN (unique reference number) of the nursery'),
  },
  async ({ urn }) => {
    const data = await apiFetch(`/api/v1/nurseries/${encodeURIComponent(urn)}`)
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    }
  }
)

server.tool(
  'compare_nurseries',
  'Compare 2-10 nurseries side by side. Returns a comparison table with Ofsted grades, fees, availability, and scores.',
  {
    urns: z.array(z.string()).min(2).max(10).describe('Array of Ofsted URNs to compare'),
  },
  async ({ urns }) => {
    const data = await apiFetch('/api/v1/nurseries/compare', {
      method: 'POST',
      body: JSON.stringify({ urns }),
    })
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    }
  }
)

server.tool(
  'get_area',
  'Get family score and statistics for a UK postcode district (e.g. "SW11", "BS6"). Includes nursery counts, crime rate, parks, and property prices.',
  {
    district: z.string().describe('UK postcode district (e.g. "SW11", "N1", "BS6")'),
  },
  async ({ district }) => {
    const data = await apiFetch(`/api/v1/areas/${encodeURIComponent(district)}`)
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    }
  }
)

server.tool(
  'get_nursery_markdown',
  'Get a nursery profile as formatted markdown — ideal for reading aloud or summarising to parents.',
  {
    urn: z.string().describe('Ofsted URN of the nursery'),
  },
  async ({ urn }) => {
    const text = await apiFetch(`/api/v1/public/nursery/${encodeURIComponent(urn)}.md`)
    return {
      content: [{ type: 'text', text: typeof text === 'string' ? text : JSON.stringify(text) }],
    }
  }
)

server.tool(
  'get_area_markdown',
  'Get an area summary as formatted markdown — family score, nursery quality, crime, property prices.',
  {
    district: z.string().describe('UK postcode district (e.g. "SW11")'),
  },
  async ({ district }) => {
    const text = await apiFetch(`/api/v1/public/area/${encodeURIComponent(district)}.md`)
    return {
      content: [{ type: 'text', text: typeof text === 'string' ? text : JSON.stringify(text) }],
    }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
