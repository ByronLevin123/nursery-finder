'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isInCompare, addToCompare, removeFromCompare, FREE_COMPARE_LIMIT } from '@/lib/compare'
import { useSession } from '@/components/SessionProvider'
import ConfirmModal from '@/components/ConfirmModal'

interface Props {
  urn: string
}

export default function CompareButton({ urn }: Props) {
  const [inCompare, setInCompare] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [alertMsg, setAlertMsg] = useState('')
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
      setShowConfirm(true)
    } else if (result === 'full') {
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
      <ConfirmModal
        open={showConfirm}
        title="Sign in to compare more"
        message={`Free comparison holds ${FREE_COMPARE_LIMIT} nurseries. Sign in (free) to compare more. Continue to sign in?`}
        confirmLabel="Sign in"
        onConfirm={() => { setShowConfirm(false); router.push('/login?next=/compare') }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  )
}
