'use client'

import { useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function ViewTracker({ urn }: { urn: string }) {
  useEffect(() => {
    // Fire and forget — don't block rendering
    fetch(`${API_URL}/api/v1/nurseries/${encodeURIComponent(urn)}/view`, {
      method: 'POST',
    }).catch(() => {})
  }, [urn])

  return null
}
