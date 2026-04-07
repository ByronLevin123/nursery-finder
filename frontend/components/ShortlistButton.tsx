'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addToShortlist, removeFromShortlist, isInShortlist, FREE_SHORTLIST_LIMIT } from '@/lib/shortlist'
import { useSession } from '@/components/SessionProvider'

interface Props {
  urn: string
}

export default function ShortlistButton({ urn }: Props) {
  const [saved, setSaved] = useState(false)
  const { user } = useSession()
  const router = useRouter()

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
    const result = addToShortlist(urn, !!user)
    if (result === 'auth_required') {
      const ok = window.confirm(
        `Free shortlist holds ${FREE_SHORTLIST_LIMIT} nurseries. Sign in (free) to save more. Continue to sign in?`
      )
      if (ok) router.push('/login?next=/shortlist')
    } else if (result === 'full') {
      window.alert('Shortlist is full (10 max).')
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
