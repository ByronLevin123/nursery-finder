import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Public API',
  description:
    'Free read-only API for UK nursery, area and property data. OpenAPI 3.1 spec, JSON + markdown endpoints, designed for LLM agents and Custom GPTs.',
  alternates: { canonical: '/api' },
  openGraph: {
    title: 'NurseryMatch Public API',
    description:
      'Free read-only API for UK nursery, area and property data. OpenAPI 3.1 spec, JSON + markdown endpoints.',
    url: '/api',
    siteName: 'NurseryMatch',
    type: 'website',
    locale: 'en_GB',
  },
}

const API = process.env.NEXT_PUBLIC_API_URL || ''

const ENDPOINTS: { method: string; path: string; description: string; auth?: boolean }[] = [
  { method: 'POST', path: '/api/v1/nurseries/search', description: 'Search nurseries near a UK postcode (JSON body).' },
  { method: 'POST', path: '/api/v1/nurseries/smart-search', description: 'Smart search with natural language query.' },
  { method: 'POST', path: '/api/v1/nurseries/compare', description: 'Compare multiple nurseries side by side.' },
  { method: 'GET', path: '/api/v1/nurseries/autocomplete', description: 'Autocomplete nursery names.' },
  { method: 'GET', path: '/api/v1/nurseries/{urn}', description: 'Look up a single nursery by Ofsted URN.' },
  { method: 'GET', path: '/api/v1/nurseries/{urn}/similar', description: 'Find similar nurseries.' },
  { method: 'GET', path: '/api/v1/nurseries/{urn}/reviews', description: 'List parent reviews for a nursery.' },
  { method: 'GET', path: '/api/v1/areas/{district}', description: 'Get the family-relocation summary for a postcode district.' },
  { method: 'GET', path: '/api/v1/areas/family-search', description: 'Find family-friendly areas near a postcode.' },
  { method: 'GET', path: '/api/v1/areas/{district}/nurseries', description: 'List all active nurseries inside a district.' },
  { method: 'GET', path: '/api/v1/properties/districts', description: 'Browse districts by affordability and family score.' },
  { method: 'GET', path: '/api/v1/overlays/schools/near', description: 'Schools near a coordinate.' },
  { method: 'POST', path: '/api/v1/travel/time', description: 'Calculate travel time between two points.' },
  { method: 'POST', path: '/api/v1/travel/isochrone', description: 'Generate isochrone polygon.' },
  { method: 'GET', path: '/api/v1/nurseries/{urn}/summary', description: 'AI-generated nursery summary.' },
  { method: 'GET', path: '/api/v1/nurseries/{urn}/review-synthesis', description: 'AI synthesis of nursery reviews.' },
  { method: 'POST', path: '/api/v1/assistant/chat', description: 'AI move assistant chat.' },
  { method: 'GET', path: '/api/v1/public/nursery/{urn}.md', description: 'Markdown summary of a nursery (LLM-friendly).' },
  { method: 'GET', path: '/api/v1/public/area/{district}.md', description: 'Markdown summary of a postcode district.' },
  { method: 'GET', path: '/api/v1/blog', description: 'List guides and blog posts.' },
  { method: 'GET', path: '/api/v1/billing/tiers', description: 'Available subscription tiers and pricing.' },
]

export default function ApiDocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Public API</h1>
      <p className="text-gray-600 mb-8">
        Free API for UK nursery, area and property data. Over 100 endpoints covering
        nurseries, areas, properties, AI features, and more. Designed for LLM agents, ChatGPT
        Custom GPTs, research projects and journalism.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <p className="text-sm text-indigo-900 font-medium mb-2">Interactive API docs</p>
          <a
            href={`${API}/api/docs`}
            className="text-indigo-700 font-mono text-sm break-all hover:underline"
          >
            {API}/api/docs
          </a>
          <p className="text-xs text-indigo-700 mt-2">
            Swagger UI — browse and try all 100+ endpoints in your browser.
          </p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <p className="text-sm text-indigo-900 font-medium mb-2">OpenAPI 3.1 specification</p>
          <a
            href={`${API}/api/openapi.json`}
            className="text-indigo-700 font-mono text-sm break-all hover:underline"
          >
            {API}/api/openapi.json
          </a>
          <p className="text-xs text-indigo-700 mt-2">
            Paste this URL into ChatGPT &gt; Configure &gt; Actions to ship a Custom GPT.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Endpoints</h2>
      <div className="border border-gray-200 rounded-xl divide-y divide-gray-200 mb-10">
        {ENDPOINTS.map((e) => (
          <div key={`${e.method} ${e.path}`} className="p-4 flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold px-2 py-1 rounded ${
                  e.method === 'GET' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {e.method}
              </span>
              <code className="text-sm text-gray-900">{e.path}</code>
            </div>
            <p className="text-sm text-gray-600 ml-12">{e.description}</p>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Example</h2>
      <pre className="bg-gray-900 text-gray-100 rounded-xl p-5 overflow-x-auto text-sm mb-10">
{`curl ${API}/api/v1/areas/SW11

curl -X POST ${API}/api/v1/nurseries/search \\
  -H 'Content-Type: application/json' \\
  -d '{"postcode":"SW11 1AA","radius_km":2}'

curl ${API}/api/v1/public/area/SW11.md`}
      </pre>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Rate limits</h2>
      <p className="text-gray-700 mb-8">
        Public endpoints are limited to <strong>100 requests per 15 minutes per IP</strong>.
        If you need higher throughput, get in touch.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Attribution</h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-1 mb-10">
        <li>
          Nursery data is from the Ofsted Early Years register, licensed under the{' '}
          <a
            href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
            className="text-indigo-600 hover:underline"
          >
            Open Government Licence v3.0
          </a>
          . Always cite Ofsted when reproducing grades.
        </li>
        <li>Property data is derived from HM Land Registry and PropertyData.co.uk.</li>
        <li>Crime data: data.police.uk. Flood data: Environment Agency. IMD: ONS.</li>
      </ul>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">LLM-friendly discovery</h2>
      <p className="text-gray-700 mb-2">
        We publish <code>/llms.txt</code> and <code>/llms-full.txt</code> for AI crawlers, and
        markdown variants of every nursery and area page under <code>/api/v1/public/*.md</code>.
      </p>
    </div>
  )
}
