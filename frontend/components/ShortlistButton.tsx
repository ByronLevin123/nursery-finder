'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addToShortlist, removeFromShortlist, isInShortlist, FREE_SHORTLIST_LIMIT } from '@/lib/shortlist'
import { useSession } from '@/components/SessionProvider'
import ConfirmModal from '@/components/ConfirmModal'

interface Props {
  urn: string
}

export default function ShortlistButton({ urn }: Props) {
  const [saved, setSaved] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [alertMsg, setAlertMsg] = useState('')
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
      setShowConfirm(true)
    } else if (result === 'full') {
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
        {saved ? '❤️' : '🤍'}
      </button>
      {alertMsg && (
        <span className="text-xs text-amber-600 ml-1">{alertMsg}</span>
      )}
      <ConfirmModal
        open={showConfirm}
        title="Sign in to save more"
        message={`Free shortlist holds ${FREE_SHORTLIST_LIMIT} nurseries. Sign in (free) to save more. Continue to sign in?`}
        confirmLabel="Sign in"
        onConfirm={() => { setShowConfirm(false); router.push('/login?next=/shortlist') }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  )
}
