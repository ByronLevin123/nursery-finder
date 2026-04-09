'use client'

import { useEffect } from 'react'
import { addRecentlyViewed } from '@/lib/recentlyViewed'

interface Props {
  urn: string
  name: string
  grade: string | null
  town: string | null
}

export default function RecentlyViewedTracker({ urn, name, grade, town }: Props) {
  useEffect(() => {
    addRecentlyViewed({ urn, name, grade, town })
  }, [urn, name, grade, town])

  return null
}
