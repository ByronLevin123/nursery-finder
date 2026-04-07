'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isInCompare, addToCompare, removeFromCompare, FREE_COMPARE_LIMIT } from '@/lib/compare'
import { useSession } from '@/components/SessionProvider'

interface Props {
  urn: string
}

export default function CompareButton({ urn }: Props) {
  const [inCompare, setInCompare] = useState(false)
  const { user } = useSession()
  const router = useRouter()

  useEffect(() => {
    setInCompare(isInCompare(urn))
    const handler = () => setInCompare(isInCompare(urn))
    window.addEventListener('compare-updated', handler)
    return () => window.removeEventListener('compare-updated', handler)
  }, [urn])

  function toggle() {
    if (inCompare) {
      removeFromCompare(urn)
      return
    }
    const result = addToCompare(urn, !!user)
    if (result === 'auth_required') {
      const ok = window.confirm(
        `Free comparison holds ${FREE_COMPARE_LIMIT} nurseries. Sign in (free) to compare more. Continue to sign in?`
      )
      if (ok) router.push('/login?next=/compare')
    } else if (result === 'full') {
      window.alert('Comparison is full (5 max).')
    }
  }

  return (
    <button
      onClick={toggle}
      className={`text-lg transition-all ${
        inCompare
          ? 'text-blue-600 scale-110'
          : 'text-gray-300 hover:text-blue-400'
      }`}
      title={inCompare ? 'Remove from comparison' : 'Add to comparison'}
    >
      &#9878;
    </button>
  )
}
