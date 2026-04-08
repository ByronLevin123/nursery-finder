'use client'

import dynamic from 'next/dynamic'
import type { AssistantArea } from '@/lib/api'

const InnerMap = dynamic(() => import('./InnerMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm text-gray-400">
      Loading map…
    </div>
  ),
})

interface Props {
  results: AssistantArea[]
  isochrone?: any
}

export default function DistrictMatchMap({ results, isochrone }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden h-full min-h-[480px]">
      <InnerMap results={results} isochrone={isochrone} />
    </div>
  )
}
