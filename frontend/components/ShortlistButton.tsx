'use client'

import { useState, useEffect } from 'react'
import { addToShortlist, removeFromShortlist, isInShortlist } from '@/lib/shortlist'

interface Props {
  urn: string
}

export default function ShortlistButton({ urn }: Props) {
  const [saved, setSaved] = useState(false)
  const [alertMsg, setAlertMsg] = useState('')

  useEffect(() => {
    setSaved(isInShortlist(urn))
    const handler = () => setSaved(isInShortlist(urn))
    window.addEventListener('shortlist-updated', handler)
    return () => window.removeEventListener('shortlist-updated', handler)
  }, [urn])

  function toggle() {
    if (saved) {
      removeFromShortlist(urn)
      return
    }
    const result = addToShortlist(urn)
    if (result === 'full') {
      setAlertMsg('Shortlist is full (10 max).')
      setTimeout(() => setAlertMsg(''), 3000)
    }
  }

  return (
    <>
      <button
        onClick={toggle}
        className="flex-shrink-0 text-xl hover:scale-110 transition-transform"
        title={saved ? 'Remove from shortlist' : 'Add to shortlist'}
      >
        {saved ? '\u2764\uFE0F' : '\uD83E\uDD0D'}
      </button>
      {alertMsg && (
        <span className="text-xs text-amber-600 ml-1">{alertMsg}</span>
      )}
    </>
  )
}
