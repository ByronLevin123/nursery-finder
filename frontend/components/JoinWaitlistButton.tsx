'use client'

import { useState } from 'react'
import { useSession } from '@/components/SessionProvider'
import { API_URL } from '@/lib/api'
import Link from 'next/link'

interface Props {
  nurseryId: string
  nurseryUrn: string
  nurseryName: string
  spotsAvailable?: number | null
  hasWaitlist?: boolean
}

export default function JoinWaitlistButton({
  nurseryId,
  nurseryUrn,
  nurseryName,
  spotsAvailable,
  hasWaitlist,
}: Props) {
  const { session } = useSession()
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')

  // Only show when nursery is full and has a waitlist
  if (spotsAvailable == null || spotsAvailable > 0 || !hasWaitlist) return null

  if (joined) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg">
        On waitlist
      </span>
    )
  }

  if (!session) {
    return (
      <Link
        href={`/login?next=/nursery/${nurseryUrn}`}
        className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
      >
        Sign in to join waitlist
      </Link>
    )
  }

  async function handleJoin() {
    if (!session) return
    setJoining(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/waitlist/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ nursery_id: nurseryId, nursery_urn: nurseryUrn }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to join waitlist')
      }
      setJoined(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setJoining(false)
    }
  }

  return (
    <>
      <button
        onClick={handleJoin}
        disabled={joining}
        className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50"
      >
        {joining ? 'Joining...' : 'Join waitlist'}
      </button>
      {error && <span className="text-xs text-red-600 ml-2">{error}</span>}
    </>
  )
}
