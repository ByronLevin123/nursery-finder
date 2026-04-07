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
}

export default function DistrictMatchMap({ results }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden h-full min-h-[480px]">
      <InnerMap results={results} />
    </div>
  )
}
