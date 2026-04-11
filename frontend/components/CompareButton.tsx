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
        className={`text-lg transition-all ${
          inCompare
            ? 'text-blue-600 scale-110'
            : 'text-gray-300 hover:text-blue-400'
        }`}
        title={inCompare ? 'Remove from comparison' : 'Add to comparison'}
      >
        &#9878;
      </button>
      {alertMsg && (
        <span className="text-xs text-amber-600 ml-1">{alertMsg}</span>
      )}
    </>
  )
}
