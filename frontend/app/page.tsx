import { Metadata } from 'next'
import HomeSearch from '@/components/HomeSearch'

export const metadata: Metadata = {
  title: 'NurseryFinder — Compare UK Nurseries by Ofsted Grade',
  description: 'Find and compare Ofsted-rated nurseries near you. Search by postcode, filter by grade, and find funded places. Free to use.',
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero */}
      <div className="max-w-3xl mx-auto px-4 pt-16 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Find the right nursery for your child
        </h1>
        <p className="text-xl text-gray-600 mb-10">
          Search thousands of Ofsted-rated nurseries across the UK.
          Compare grades, funded places, and inspection history — free.
        </p>

        <HomeSearch />
      </div>

      {/* Trust signals */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: '🏫', title: '80,000+ nurseries', body: 'Every registered nursery in England from the Ofsted Early Years Register' },
            { icon: '⭐', title: 'Official Ofsted data', body: 'Inspection grades and reports sourced directly from Ofsted. Updated monthly.' },
            { icon: '💷', title: 'Free to use', body: 'No sign-up required. Compare as many nurseries as you need.' },
          ].map(card => (
            <div key={card.title} className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">{card.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{card.title}</h3>
              <p className="text-sm text-gray-600">{card.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Two paths */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <a href="/search" className="block bg-white rounded-xl border-2 border-blue-200 p-8 text-center hover:border-blue-400 transition-colors">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Find a nursery near me</h3>
            <p className="text-sm text-gray-600">Search by postcode. Filter by Ofsted grade, funded places, and distance.</p>
          </a>
          <a href="/find-an-area" className="block bg-white rounded-xl border-2 border-green-200 p-8 text-center hover:border-green-400 transition-colors">
            <div className="text-4xl mb-3">🏡</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Find an area to move to</h3>
            <p className="text-sm text-gray-600">Compare areas by Family Score — nursery quality, safety, schools, and property prices.</p>
          </a>
        </div>
      </div>
    </div>
  )
}
