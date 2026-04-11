'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'
import { API_URL } from '@/lib/api'
import PromptModal from '@/components/PromptModal'

interface Props {
  criteria: Record<string, unknown>
  defaultName?: string
  className?: string
}

export default function SaveSearchButton({ criteria, defaultName, className }: Props) {
  const { session } = useSession()
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  if (!session) {
    return (
      <Link
        href="/login?next=/account"
        className={
          className ||
          'inline-block px-3 py-1.5 text-xs border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50'
        }
      >
        Sign in to save this search
      </Link>
    )
  }

  async function doSave(name: string) {
    if (!session) return
    setShowPrompt(false)
    setSaving(true)
    setToast(null)
    try {
      const res = await fetch(`${API_URL}/api/v1/saved-searches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name, criteria }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error || 'Failed to save')
      }
      setToast('Saved!')
    } catch (err: unknown) {
      setToast(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowPrompt(true)}
        disabled={saving}
        className={
          className ||
          'inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 disabled:opacity-50'
        }
      >
        {saving ? 'Saving…' : toast || 'Save this search'}
      </button>
      <PromptModal
        open={showPrompt}
        title="Name this saved search"
        placeholder="e.g. Near work, SW London"
        defaultValue={defaultName || ''}
        submitLabel="Save"
        onSubmit={doSave}
        onCancel={() => setShowPrompt(false)}
      />
    </>
  )
}
