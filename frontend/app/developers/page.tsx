import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Developers — Add Nursery Intelligence to Your App',
  description:
    'Free API and embeddable widget for property portals, estate agents, and relocation platforms. Family scores, nursery search, area intelligence for any UK postcode.',
}

const TIERS = [
  {
    name: 'Free',
    price: '£0',
    period: '/month',
    requests: '1,000 requests/day',
    features: [
      'Family Score API',
      'Nursery search by postcode',
      'Area intelligence (crime, schools, property)',
      'Embeddable widget',
      'NurseryMatch branding on widget',
    ],
    cta: 'Get free API key',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '£49',
    period: '/month',
    requests: '10,000 requests/day',
    features: [
      'Everything in Free',
      'Remove widget branding',
      'Travel time + isochrone API',
      'AI nursery summaries',
      'Priority support',
    ],
    cta: 'Start Pro trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    requests: '100,000+ requests/day',
    features: [
      'Everything in Pro',
      'White-label widget',
      'Bulk data export',
      'Webhook notifications',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    cta: 'Contact us',
    highlight: false,
  },
]

const CODE_EXAMPLES = {
  html: `<!-- Add to any property listing page -->
<div data-nursery-widget
     data-postcode="SW11 1AA"
     data-limit="5"
     data-api-key="YOUR_KEY">
</div>
<script src="https://nurserymatch.com/embed.js" defer></script>`,
  curl: `# Get Family Score for a postcode district
curl -H "X-Api-Key: YOUR_KEY" \\
  "https://nursery-finder-6u7r.onrender.com/api/v1/areas/SW11"

# Search nurseries near a postcode
curl -X POST -H "Content-Type: application/json" \\
  -H "X-Api-Key: YOUR_KEY" \\
  -d '{"postcode":"SW11 1AA","radius_km":3}' \\
  "https://nursery-finder-6u7r.onrender.com/api/v1/nurseries/search"`,
  javascript: `// Fetch Family Score for a district
const res = await fetch(
  'https://nursery-finder-6u7r.onrender.com/api/v1/areas/SW11',
  { headers: { 'X-Api-Key': 'YOUR_KEY' } }
);
const area = await res.json();

console.log(area.family_score);      // 78
console.log(area.nursery_count_total); // 42
console.log(area.avg_sale_price_all);  // 725000`,
}

export default function DevelopersPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-16">
        <span className="inline-block px-3 py-1 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-full mb-4">
          Developer API
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Add nursery intelligence to your property listings
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          Free API and embeddable widget. Family scores, nursery search, area
          intelligence, school data, and travel times for any UK postcode.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/login?redirect=/account/developer"
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            Get your API key
          </Link>
          <Link
            href="/api/docs"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            View API docs
          </Link>
        </div>
      </div>

      {/* Use cases */}
      <div className="grid md:grid-cols-4 gap-6 mb-16">
        {[
          { title: 'Property portals', desc: 'Show nursery proximity on every listing', icon: '🏠' },
          { title: 'Estate agents', desc: 'Family Score badge on property pages', icon: '🏢' },
          { title: 'Relocation platforms', desc: 'Area intelligence for corporate moves', icon: '✈️' },
          { title: 'Parenting apps', desc: 'Nursery search + reviews in your app', icon: '👶' },
        ].map((uc) => (
          <div key={uc.title} className="p-6 bg-gray-50 rounded-xl text-center">
            <div className="text-3xl mb-3">{uc.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-1">{uc.title}</h3>
            <p className="text-sm text-gray-600">{uc.desc}</p>
          </div>
        ))}
      </div>

      {/* What data is available */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
          What you get
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: 'Family Score',
              desc: 'Composite 0-100 rating combining nursery quality, crime, schools, and property affordability for any postcode district.',
              endpoint: 'GET /api/v1/areas/{district}',
            },
            {
              title: 'Nursery search',
              desc: '26,000+ Ofsted-rated nurseries searchable by postcode with radius, grade, and funding filters.',
              endpoint: 'POST /api/v1/nurseries/search',
            },
            {
              title: 'Area intelligence',
              desc: 'Property prices, crime rates, flood risk, IMD deprivation, parks, and school quality per district.',
              endpoint: 'GET /api/v1/areas/{district}',
            },
            {
              title: 'Schools nearby',
              desc: 'Primary and secondary schools with Ofsted grades near any coordinates.',
              endpoint: 'GET /api/v1/schools/near',
            },
            {
              title: 'Travel times',
              desc: 'Walk, cycle, and drive times between any two UK locations. Isochrone polygons for commute zones.',
              endpoint: 'POST /api/v1/travel/time',
            },
            {
              title: 'AI summaries',
              desc: 'Claude-powered nursery summaries and review synthesis. Natural language nursery search.',
              endpoint: 'GET /api/v1/nurseries/{urn}/summary',
            },
          ].map((item) => (
            <div key={item.title} className="p-6 border border-gray-200 rounded-xl">
              <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600 mb-3">{item.desc}</p>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded text-indigo-600">
                {item.endpoint}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Code examples */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Integrate in minutes
        </h2>
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              HTML Embed — 3 lines
            </h3>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto text-sm">
              {CODE_EXAMPLES.html}
            </pre>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              REST API — curl
            </h3>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto text-sm">
              {CODE_EXAMPLES.curl}
            </pre>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              JavaScript
            </h3>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto text-sm">
              {CODE_EXAMPLES.javascript}
            </pre>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Simple pricing
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`p-6 rounded-xl border-2 ${
                tier.highlight
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
              <div className="mt-2 mb-1">
                <span className="text-3xl font-bold text-gray-900">{tier.price}</span>
                <span className="text-sm text-gray-500">{tier.period}</span>
              </div>
              <p className="text-sm text-indigo-600 font-medium mb-4">{tier.requests}</p>
              <ul className="space-y-2 mb-6">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-600 mt-0.5">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.name === 'Enterprise' ? '/contact' : '/login?redirect=/account/developer'}
                className={`block text-center py-2 px-4 rounded-lg font-semibold text-sm transition ${
                  tier.highlight
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">FAQ</h2>
        <div className="space-y-6">
          {[
            {
              q: 'Do I need an API key?',
              a: 'No — all public endpoints work without a key at 300 requests per 15 minutes. An API key gives you higher limits and usage tracking.',
            },
            {
              q: 'Where does the data come from?',
              a: 'Nursery data is from Ofsted (Open Government Licence v3.0). Property prices from HM Land Registry. Crime data from data.police.uk. All free, open datasets.',
            },
            {
              q: 'Can I use this on commercial property listings?',
              a: 'Yes. The Free tier includes NurseryMatch branding on the widget. Pro removes branding. Attribution for Ofsted data is required under OGL.',
            },
            {
              q: 'What are the rate limits?',
              a: 'Free: 1,000 requests/day. Pro: 10,000/day. Enterprise: 100,000+/day. Without an API key: 300 requests per 15 minutes per IP.',
            },
          ].map((faq) => (
            <div key={faq.q} className="border-b border-gray-200 pb-4">
              <h3 className="font-semibold text-gray-900 mb-1">{faq.q}</h3>
              <p className="text-sm text-gray-600">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
