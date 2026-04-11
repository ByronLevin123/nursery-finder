'use client'

import { useEffect } from 'react'
import { API_URL } from '@/lib/api'

export default function ViewTracker({ urn }: { urn: string }) {
  useEffect(() => {
    // Fire and forget — don't block rendering
    fetch(`${API_URL}/api/v1/nurseries/${encodeURIComponent(urn)}/view`, {
      method: 'POST',
    }).catch((err) => { console.error('View tracking failed:', err) })
  }, [urn])

  return null
}
