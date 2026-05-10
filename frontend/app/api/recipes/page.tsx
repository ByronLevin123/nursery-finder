import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'API Integration Recipes | CompareTheNursery',
  description: 'Copy-paste code recipes to embed nursery data into property sites, parenting blogs, and comparison platforms.',
  alternates: { canonical: '/api/recipes' },
}

const API = process.env.NEXT_PUBLIC_API_URL || ''

const RECIPES = [
  {
    id: 'nearby-nurseries',
    title: 'Nurseries near this property',
    useCase: 'Property listing sites (Zoopla, Rightmove, estate agents) showing nearby nurseries on each listing page.',
    code: `// Fetch nurseries within 2km of a postcode
const res = await fetch('${API || 'https://your-api.onrender.com'}/api/v1/nurseries/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    postcode: 'SW11 1AA',
    radius_km: 2,
    limit: 5
  })
});
const { data, meta } = await res.json();

// data = [{ urn, name, ofsted_overall_grade, distance_km, fee_avg_monthly,
//            places_funded_2yr, places_funded_3_4yr, town, postcode, lat, lng }]

// Render results
data.forEach(n => {
  console.log(\`\${n.name} — \${n.ofsted_overall_grade} — \${n.distance_km.toFixed(1)}km away\`);
  if (n.fee_avg_monthly) console.log(\`  Avg fee: £\${n.fee_avg_monthly}/month\`);
  if (n.places_funded_2yr > 0) console.log('  Accepts 2yr funded hours');
});`,
    response: `{
  "data": [
    {
      "urn": "EY123456",
      "name": "Bright Stars Nursery",
      "ofsted_overall_grade": "Outstanding",
      "distance_km": 0.4,
      "fee_avg_monthly": 1250,
      "total_places": 45,
      "places_funded_2yr": 10,
      "places_funded_3_4yr": 15,
      "lat": 51.4655,
      "lng": -0.1631
    }
  ],
  "meta": { "total": 12, "page": 1, "limit": 5 }
}`,
  },
  {
    id: 'family-score',
    title: 'Family Score badge',
    useCase: 'Estate agent listings, property portals, and relocation services showing a single family-friendliness score for an area.',
    code: `// Get family score for a postcode district
const res = await fetch('${API || 'https://your-api.onrender.com'}/api/v1/areas/SW11');
const area = await res.json();

// area.family_score = 0-100 composite score
// area.nursery_count_total = number of nurseries
// area.nursery_outstanding_pct = % rated Outstanding
// area.avg_sale_price_all = average property price
// area.crime_rate_per_1000 = crime incidents per 1000 residents

// Render a badge
const badge = document.createElement('div');
badge.innerHTML = \`
  <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;
              border-radius:24px;background:#f0fdf4;border:1px solid #bbf7d0;">
    <span style="font-size:24px;font-weight:700;color:#15803d;">
      \${area.family_score}/100
    </span>
    <span style="font-size:13px;color:#166534;">
      Family Score — \${area.nursery_count_total} nurseries nearby
    </span>
  </div>
\`;`,
    response: `{
  "postcode_district": "SW11",
  "local_authority": "Wandsworth",
  "region": "London",
  "family_score": 78,
  "nursery_count_total": 42,
  "nursery_count_outstanding": 8,
  "nursery_outstanding_pct": 19.0,
  "avg_sale_price_all": 725000,
  "crime_rate_per_1000": 85.2,
  "imd_decile": 7,
  "lat": 51.4619,
  "lng": -0.1674
}`,
  },
  {
    id: 'embed-widget',
    title: 'Embeddable nursery widget',
    useCase: 'Parenting blogs, forums, and community sites that want to embed a nursery search widget with zero development effort.',
    code: `<!-- Drop this into any HTML page -->
<div id="nursery-widget"
     data-postcode="SW11 1AA"
     data-limit="5"
     data-radius="3">
</div>
<script src="${API || 'https://comparethenursery.com'}/embed.js"></script>

<!-- The widget will render a styled list of nearby nurseries
     with Ofsted grades, fees, and links to full profiles.
     OGL attribution is included automatically. -->`,
    response: null,
  },
  {
    id: 'map-overlay',
    title: 'Nursery pins on your map',
    useCase: 'Property search sites with interactive maps (Leaflet, Mapbox, Google Maps) that want to overlay nursery locations.',
    code: `// Search nurseries and plot on a Leaflet map
const res = await fetch('${API || 'https://your-api.onrender.com'}/api/v1/nurseries/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ postcode: 'SW11 1AA', radius_km: 5, limit: 50 })
});
const { data } = await res.json();

// Add markers to your Leaflet map
data.forEach(nursery => {
  if (!nursery.lat || !nursery.lng) return;

  const color = {
    'Outstanding': '#16a34a',
    'Good': '#2563eb',
    'Requires improvement': '#d97706',
    'Inadequate': '#dc2626'
  }[nursery.ofsted_overall_grade] || '#6b7280';

  L.circleMarker([nursery.lat, nursery.lng], {
    radius: 8,
    fillColor: color,
    fillOpacity: 0.8,
    color: '#fff',
    weight: 2
  })
  .bindPopup(\`
    <strong>\${nursery.name}</strong><br>
    Ofsted: \${nursery.ofsted_overall_grade || 'Not yet inspected'}<br>
    \${nursery.distance_km ? nursery.distance_km.toFixed(1) + 'km away' : ''}
    <br><a href="https://comparethenursery.com/nursery/\${nursery.urn}" target="_blank">
      View full profile
    </a>
  \`)
  .addTo(map);
});`,
    response: null,
  },
  {
    id: 'schools-nurseries',
    title: 'Schools + nurseries combined',
    useCase: 'Family relocation services and area guides showing the full childcare-to-school picture for a location.',
    code: `// Fetch both nurseries and schools near a point
const lat = 51.4655, lng = -0.1631;

const [nurseries, schools] = await Promise.all([
  fetch('${API || 'https://your-api.onrender.com'}/api/v1/nurseries/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postcode: 'SW11 1AA', radius_km: 2, limit: 10 })
  }).then(r => r.json()),

  fetch(\`${API || 'https://your-api.onrender.com'}/api/v1/schools/near?lat=\${lat}&lng=\${lng}&radius_km=2\`)
    .then(r => r.json())
]);

console.log(\`\${nurseries.meta.total} nurseries nearby\`);
console.log(\`\${schools.data.length} primary schools nearby\`);

// Combine for a full childcare picture
const childcareReport = {
  nurseries: nurseries.data.map(n => ({
    name: n.name, grade: n.ofsted_overall_grade, type: 'nursery'
  })),
  schools: schools.data.map(s => ({
    name: s.name, phase: s.phase, type: 'school'
  }))
};`,
    response: null,
  },
]

function CodeBlock({ code, language = 'javascript' }: { code: string; language?: string }) {
  return (
    <pre className="bg-gray-900 text-gray-100 rounded-xl p-5 overflow-x-auto text-sm leading-relaxed">
      <code>{code}</code>
    </pre>
  )
}

export default function RecipesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link href="/api" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
          &larr; Back to API docs
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Integration Recipes</h1>
        <p className="text-gray-600">
          Copy-paste code examples to embed nursery and area data into property sites, parenting
          blogs, and comparison platforms. All public endpoints are free, keyless, and CORS-enabled.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-10">
        <p className="text-sm text-amber-900 font-medium mb-1">Attribution required</p>
        <p className="text-xs text-amber-800">
          Nursery data is from the Ofsted Early Years register under the Open Government Licence v3.0.
          Always include: &quot;Contains Ofsted data &copy; Crown copyright and database right&quot; when displaying nursery grades.
        </p>
      </div>

      <div className="space-y-12">
        {RECIPES.map((recipe) => (
          <section key={recipe.id} id={recipe.id} className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{recipe.title}</h2>
            <p className="text-gray-600 mb-4">{recipe.useCase}</p>
            <CodeBlock code={recipe.code} language={recipe.id === 'embed-widget' ? 'html' : 'javascript'} />
            {recipe.response && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Example response:</p>
                <CodeBlock code={recipe.response} />
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Rate limits &amp; best practices</h2>
        <ul className="list-disc pl-6 text-gray-700 space-y-2 text-sm">
          <li><strong>100 requests per 15 minutes</strong> per IP for all public endpoints.</li>
          <li>Cache responses on your side — nursery data updates weekly, area data monthly.</li>
          <li>Use the <code>limit</code> parameter to fetch only what you need.</li>
          <li>For high-volume integrations, contact us for a dedicated API key.</li>
        </ul>
      </div>

      <div className="mt-8 pt-8 border-t border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Resources</h2>
        <div className="flex flex-wrap gap-4">
          <a href={`${API}/api/docs`} className="text-sm text-blue-600 hover:underline">Swagger UI (try endpoints live)</a>
          <a href={`${API}/api/openapi.json`} className="text-sm text-blue-600 hover:underline">OpenAPI 3.1 spec</a>
          <Link href="/api" className="text-sm text-blue-600 hover:underline">Full API docs</Link>
          <Link href="/privacy" className="text-sm text-blue-600 hover:underline">Privacy policy</Link>
        </div>
      </div>
    </div>
  )
}
