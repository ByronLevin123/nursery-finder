'use client'

import { useState, useEffect } from 'react'
import { addToShortlist, removeFromShortlist, isInShortlist } from '@/lib/shortlist'

interface Props {
  urn: string
}

export default function ShortlistButton({ urn }: Props) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSaved(isInShortlist(urn))
    const handler = () => setSaved(isInShortlist(urn))
    window.addEventListener('shortlist-updated', handler)
    return () => window.removeEventListener('shortlist-updated', handler)
  }, [urn])

  function toggle() {
    if (saved) {
      removeFromShortlist(urn)
    } else {
      addToShortlist(urn)
    }
  }

  return (
    <button
      onClick={toggle}
      className="flex-shrink-0 text-xl hover:scale-110 transition-transform"
      title={saved ? 'Remove from shortlist' : 'Add to shortlist'}
    >
      {saved ? '❤️' : '🤍'}
    </button>
  )
}
