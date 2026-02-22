'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/shortlist` }
    })
    if (!error) setSent(true)
    setLoading(false)
  }

  if (sent) return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <p className="text-2xl mb-4">✉️ Check your email</p>
      <p className="text-gray-600">
        We sent a magic link to <strong>{email}</strong>.
        Click it to sign in — no password needed.
      </p>
    </div>
  )

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-2">Sign in to NurseryFinder</h1>
      <p className="text-gray-600 mb-8">Save your shortlist across devices. No password needed.</p>
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <input
          type="email" required value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="px-4 py-3 border-2 border-gray-300 rounded-xl"
        />
        <button type="submit" disabled={loading}
          className="py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Sending...' : 'Send magic link'}
        </button>
      </form>
    </div>
  )
}
