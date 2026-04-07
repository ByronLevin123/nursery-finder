'use client'

import { useState } from 'react'
import ReviewList from './ReviewList'
import ReviewForm from './ReviewForm'

interface Props {
  urn: string
}

export default function ReviewSection({ urn }: Props) {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Parent reviews</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReviewList urn={urn} refreshKey={refreshKey} />
        <ReviewForm urn={urn} onSuccess={() => setRefreshKey(k => k + 1)} />
      </div>
    </section>
  )
}
