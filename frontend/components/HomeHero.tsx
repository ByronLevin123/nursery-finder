'use client'

import { useState } from 'react'
import HomeSearch from './HomeSearch'

type SearchType = 'nursery' | 'childminder' | 'school'

const TABS: { value: SearchType; label: string }[] = [
  { value: 'nursery', label: 'Nurseries' },
  { value: 'childminder', label: 'Childminders' },
  { value: 'school', label: 'Schools' },
]

export default function HomeHero() {
  const [searchType, setSearchType] = useState<SearchType>('nursery')

  return (
    <>
      {/* Type selector tabs */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex bg-white rounded-xl border border-gray-200 shadow-sm p-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSearchType(tab.value)}
              className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                searchType === tab.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
        <a
          href="/quiz"
          className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-xl font-semibold text-lg shadow-md hover:bg-indigo-700 transition"
        >
          Take the 2-min quiz &rarr;
        </a>
      </div>
      <div id="nursery-search">
        <HomeSearch searchType={searchType} />
      </div>
      <p className="text-xs text-gray-400 mt-2">Or search by postcode above</p>
    </>
  )
}
