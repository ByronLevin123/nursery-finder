'use client'

import { useState, useEffect } from 'react'
import { isInCompare, addToCompare, removeFromCompare } from '@/lib/compare'

interface Props {
  urn: string
}

export default function CompareButton({ urn }: Props) {
  const [inCompare, setInCompare] = useState(false)
  const [alertMsg, setAlertMsg] = useState('')

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
    const result = addToCompare(urn)
    if (result === 'full') {
      setAlertMsg('Comparison is full (5 max).')
      setTimeout(() => setAlertMsg(''), 3000)
    }
  }

  return (
    <>
      <button
        onClick={toggle}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
          inCompare
            ? 'bg-purple-50 text-purple-700 border-purple-300'
            : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300 hover:text-purple-600'
        }`}
        title={inCompare ? 'Remove from comparison' : 'Add to comparison'}
      >
        {inCompare ? '- Compare' : '+ Compare'}
      </button>
      {alertMsg && (
        <span className="text-xs text-amber-600 ml-1">{alertMsg}</span>
      )}
    </>
  )
}
