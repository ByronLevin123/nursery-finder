import { Metadata } from 'next'
import HomeSearch from '@/components/HomeSearch'
import AreaSummaryCard from '@/components/AreaSummaryCard'
import OglAttribution from '@/components/OglAttribution'
import PriorityWizardButton from '@/components/PriorityWizardButton'

export const metadata: Metadata = {
  title: 'NurseryFinder — Compare UK Nurseries by Ofsted Grade',
  description:
    'Compare 27,000+ UK nurseries with real Ofsted ratings, family scores by area, live property data, and anonymous parent reviews.',
}

const POPULAR_DISTRICTS = [
  'SW11', 'SW19', 'N16', 'E8', 'NW3', 'BN1',
  'BS6', 'M20', 'LS6', 'EH9', 'CF11', 'G12',
]

const FEATURES = [
  {
    icon: '🏫',
    title: 'Every UK nursery',
    body: 'Full Ofsted register, updated weekly, with enforcement warnings and inspection staleness flags.',
  },
  {
    icon: '📊',
    title: 'Family score by area',
    body: 'A single 0–100 rating combining nursery quality, crime, deprivation, and affordability.',
  },
  {
    icon: '💬',
    title: 'Honest parent reviews',
    body: 'Anonymous, moderated, no sign-up required to read.',
  },
]

const STEPS = [
  { n: 1, title: 'Search', body: 'by postcode, town, or nursery name' },
  { n: 2, title: 'Compare', body: 'side-by-side ratings, fees, places, reviews' },
  { n: 3, title: 'Decide', body: 'save your shortlist and see the area intelligence' },
]

export default function HomePage() {
  return (
    <div className="bg-gradient-to-b from-indigo-50 via-white to-white">
      {/* Hero */}
      <section className="px-4 pt-16 pb-14">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            Find the right nursery — and the right area
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-10">
            Compare 27,000+ UK nurseries with real Ofsted ratings, live market data, and parent reviews.
          </p>
          <HomeSearch />
          <PriorityWizardButton />
          <p className="text-xs text-gray-500 mt-6">
            <span className="font-semibold text-gray-700">27,808</span> nurseries
            <span className="mx-2">·</span>
            <span className="font-semibold text-gray-700">2,020</span> districts
            <span className="mx-2">·</span>
            Updated daily
          </p>
        </div>
      </section>

      {/* What you get */}
      <section className="px-4 py-14 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-10">
            What you get
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live area example */}
      <section className="px-4 py-14">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              See a real area at a glance
            </h2>
            <p className="text-gray-600">
              Live data for SW11 (Battersea) — nurseries, sold prices, market activity, and family score.
            </p>
          </div>
          <AreaSummaryCard district="SW11" variant="full" />
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-14 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-10">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map(s => (
              <div key={s.n} className="text-center px-4">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-lg flex items-center justify-center">
                  {s.n}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-sm text-gray-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular areas */}
      <section className="px-4 py-14">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-3">
            Popular areas
          </h2>
          <p className="text-center text-gray-600 mb-8">
            Jump straight into a district report
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {POPULAR_DISTRICTS.map(d => (
              <a
                key={d}
                href={`/nurseries-in/${d.toLowerCase()}`}
                className="px-4 py-2 rounded-full border border-purple-200 bg-purple-50 text-purple-800 text-sm font-medium hover:bg-purple-100 hover:border-purple-300 transition"
              >
                {d}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
            Ready to find your next nursery?
          </h2>
          <a
            href="/search"
            className="inline-block px-8 py-3 bg-white text-indigo-700 text-lg font-semibold rounded-xl hover:bg-indigo-50 transition shadow-lg"
          >
            Start searching
          </a>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <OglAttribution />
      </div>
    </div>
  )
}
