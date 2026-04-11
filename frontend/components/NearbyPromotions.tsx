'use client'

import { useState, useEffect } from 'react'
import { API_URL } from '@/lib/api'
import PromotionCard from '@/components/PromotionCard'

interface Props {
  lat: number
  lng: number
  title?: string
  maxItems?: number
}

export default function NearbyPromotions({ lat, lng, title = 'Nearby activities for your child', maxItems = 3 }: Props) {
  const [promotions, setPromotions] = useState<any[]>([])

  useEffect(() => {
    if (!lat || !lng) return
    fetch(`${API_URL}/api/v1/promotions/nearby?lat=${lat}&lng=${lng}`)
      .then(r => r.json())
      .then(data => setPromotions((data.data || []).slice(0, maxItems)))
      .catch(() => setPromotions([]))
  }, [lat, lng, maxItems])

  if (promotions.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {promotions.map((promo) => (
          <PromotionCard key={promo.id} promotion={promo} compact />
        ))}
      </div>
    </section>
  )
}
