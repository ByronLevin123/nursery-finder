'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function LoginInner() {
  const params = useSearchParams()
  const next = params.get('next') || '/shortlist'
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogle() {
    setError(null)
    const redirectTo = `${window.location.origin}${next.startsWith('/') ? next : '/' + next}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) setError(error.message)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const redirectTo = `${window.location.origin}${next.startsWith('/') ? next : '/' + next}`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  if (sent)
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="inline-block bg-blue-50 rounded-full p-6 mb-6">
          <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-2xl font-bold text-gray-900 mb-2">Check your email</p>
        <p className="text-gray-600">
          We sent a magic link to <strong>{email}</strong>.<br />
          Click it to sign in — no password needed.
        </p>
      </div>
    )

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Sign in to CompareTheNursery</h1>
      <p className="text-gray-600 mb-8">
        Save your shortlist, sync preferences across devices, and get alerts on new matches.
      </p>
      <button
        type="button"
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-3 py-3 mb-4 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
          />
        </svg>
        Sign in with Google
      </button>
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Sending…' : 'Send magic link'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
      <p className="mt-6 text-xs text-gray-500 text-center">
        We never share your email. No password required.
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto px-4 py-16 text-center text-gray-500">Loading…</div>}>
      <LoginInner />
    </Suspense>
  )
}
