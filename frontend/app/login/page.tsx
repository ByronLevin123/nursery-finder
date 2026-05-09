'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { isPasswordValid } from '@/lib/validation'
import { API_URL } from '@/lib/api'

type Tab = 'signin' | 'signup'
type AuthMethod = 'password' | 'magic-link'
type SuccessView = null | 'magic-link-sent' | 'signup-confirm' | 'password-reset-sent'

function LoginInner() {
  const params = useSearchParams()
  const router = useRouter()
  const explicitNext = params.get('next')
  const next = explicitNext && explicitNext.startsWith('/') && !explicitNext.startsWith('//') ? explicitNext : '/shortlist'
  const confirmed = params.get('confirmed')

  const [tab, setTab] = useState<Tab>('signin')
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successView, setSuccessView] = useState<SuccessView>(null)

  async function handleGoogle() {
    setError(null)
    const redirectTo = `${window.location.origin}${next.startsWith('/') ? next : '/' + next}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) setError(error.message)
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (explicitNext) {
      router.push(next)
      return
    }
    // No explicit redirect — route based on role
    try {
      const token = data.session?.access_token
      if (token) {
        const r = await fetch(`${API_URL}/api/v1/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (r.ok) {
          const profile = await r.json()
          if (profile.role === 'provider') { router.push('/provider'); return }
          if (profile.role === 'admin') { router.push('/admin'); return }
        }
      }
    } catch {
      // Fall through to default
    }
    router.push('/shortlist')
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const redirectTo = `${window.location.origin}${next.startsWith('/') ? next : '/' + next}`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    if (error) setError(error.message)
    else setSuccessView('magic-link-sent')
    setLoading(false)
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    const check = isPasswordValid(password)
    if (!check.valid) {
      setError(check.error || 'Invalid password')
      return
    }

    setLoading(true)
    const redirectTo = `${window.location.origin}/login?confirmed=true`
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: redirectTo,
      },
    })
    if (error) setError(error.message)
    else setSuccessView('signup-confirm')
    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Enter your email address first')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) setError(error.message)
    else setSuccessView('password-reset-sent')
    setLoading(false)
  }

  // Success states
  if (successView === 'magic-link-sent')
    return (
      <SuccessMessage
        icon="email"
        title="Check your email"
        message={<>We sent a magic link to <strong>{email}</strong>. Click it to sign in — no password needed.</>}
      />
    )

  if (successView === 'signup-confirm')
    return (
      <SuccessMessage
        icon="email"
        title="Verify your email"
        message={<>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then sign in with your password.</>}
      />
    )

  if (successView === 'password-reset-sent')
    return (
      <SuccessMessage
        icon="email"
        title="Password reset sent"
        message={<>Check <strong>{email}</strong> for a link to reset your password.</>}
      />
    )

  const signUpDisabled =
    loading ||
    !email.trim() ||
    !displayName.trim() ||
    password.length < 8 ||
    password !== confirmPassword

  const signInDisabled = loading || !email.trim() || !password.trim()

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        {tab === 'signin' ? 'Sign in to CompareTheNursery' : 'Create your account'}
      </h1>
      <p className="text-gray-600 mb-6">
        {tab === 'signin'
          ? 'Save your shortlist, sync preferences across devices, and get alerts on new matches.'
          : 'Join CompareTheNursery to save nurseries, compare options, and get personalised alerts.'}
      </p>

      {/* Confirmed email banner */}
      {confirmed && tab === 'signin' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-800 font-medium">Email verified! You can now sign in.</p>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
        <button
          type="button"
          onClick={() => { setTab('signin'); setError(null) }}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
            tab === 'signin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setTab('signup'); setError(null) }}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
            tab === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Google OAuth */}
      <button
        type="button"
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-3 py-3 mb-4 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
        {tab === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}
      </button>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* ---- SIGN IN TAB ---- */}
      {tab === 'signin' && (
        <>
          {/* Auth method toggle */}
          <div className="flex mb-4 gap-2">
            <button
              type="button"
              onClick={() => { setAuthMethod('password'); setError(null) }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                authMethod === 'password'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              Email &amp; Password
            </button>
            <button
              type="button"
              onClick={() => { setAuthMethod('magic-link'); setError(null) }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                authMethod === 'magic-link'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              Magic Link
            </button>
          </div>

          {authMethod === 'password' ? (
            <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={signInDisabled}
                className="py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-blue-600 hover:text-blue-800 text-center"
              >
                Forgot password?
              </button>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
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
                {loading ? 'Sending...' : 'Send magic link'}
              </button>
            </form>
          )}
        </>
      )}

      {/* ---- SIGN UP TAB ---- */}
      {tab === 'signup' && (
        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Full name"
            className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
          />
          <div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8 characters)"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
            />
            {password.length > 0 && password.length < 8 && (
              <p className="text-xs text-red-500 mt-1">Password must be at least 8 characters</p>
            )}
          </div>
          <div>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
            />
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>
          <button
            type="submit"
            disabled={signUpDisabled}
            className="py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      )}

      {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}

      {/* Provider link */}
      <div className="mt-8 pt-6 border-t border-gray-200 text-center">
        <p className="text-sm text-gray-600">
          Are you a nursery provider?{' '}
          <Link href="/provider/register" className="text-blue-600 hover:text-blue-800 font-medium">
            Register your nursery
          </Link>
        </p>
      </div>

      <p className="mt-4 text-xs text-gray-500 text-center">
        We never share your email.
      </p>
    </div>
  )
}

function SuccessMessage({ icon, title, message }: { icon: string; title: string; message: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="inline-block bg-blue-50 rounded-full p-6 mb-6">
        <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-2">{title}</p>
      <p className="text-gray-600">{message}</p>
      <Link href="/login" className="inline-block mt-6 text-blue-600 hover:text-blue-800 font-medium text-sm">
        Back to sign in
      </Link>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>}>
      <LoginInner />
    </Suspense>
  )
}
