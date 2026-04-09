'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'
import { getProfile, updateProfile, getSubscription, createPortalSession, getAuthToken, type Profile, type ProfileChild, type SubscriptionInfo } from '@/lib/api'
import { loadPreferences, savePreferences, hasActivePreferences, DEFAULT_PREFERENCES, type Preferences } from '@/lib/preferences'

interface SavedSearch {
  id: string
  postcode: string
  radius_km: number
  grade_filter: string | null
  funded_2yr: boolean
  funded_3yr: boolean
  alert_on_new: boolean
  name: string | null
}

export default function AccountPage() {
  const router = useRouter()
  const { session, user, loading: sessionLoading, signOut } = useSession()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  // Form state mirrors profile
  const [displayName, setDisplayName] = useState('')
  const [homePostcode, setHomePostcode] = useState('')
  const [workPostcode, setWorkPostcode] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [emailAlerts, setEmailAlerts] = useState(false)
  const [children, setChildren] = useState<ProfileChild[]>([])

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const token = session.access_token
      const p = await getProfile(token)
      if (p) {
        setProfile(p)
        setDisplayName(p.display_name || '')
        setHomePostcode(p.home_postcode || '')
        setWorkPostcode(p.work_postcode || '')
        setAvatarUrl(p.avatar_url || '')
        setEmailAlerts(!!p.email_alerts)
        setChildren(Array.isArray(p.children) ? p.children : [])
      }
      const subInfo = await getSubscription(token)
      setSubscription(subInfo)
      const { data } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      setSearches(data || [])
      setPrefs(loadPreferences())
    } catch (err: any) {
      setError(err?.message || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (sessionLoading) return
    if (!session) {
      router.push('/login?next=/account')
      return
    }
    load()
  }, [session, sessionLoading, router, load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateProfile(session.access_token, {
        display_name: displayName || null,
        home_postcode: homePostcode || null,
        work_postcode: workPostcode || null,
        avatar_url: avatarUrl || null,
        email_alerts: emailAlerts,
        children,
      })
      setProfile(updated)
      setSavedAt(Date.now())
    } catch (err: any) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function syncPrefsToServer() {
    if (!session) return
    setSaving(true)
    try {
      savePreferences(prefs)
      const updated = await updateProfile(session.access_token, { preferences: prefs })
      setProfile(updated)
      setSavedAt(Date.now())
    } catch (err: any) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function addChild() {
    setChildren((prev) => [...prev, { name: '', age_months: 0 }])
  }
  function removeChild(idx: number) {
    setChildren((prev) => prev.filter((_, i) => i !== idx))
  }
  function updateChild(idx: number, patch: Partial<ProfileChild>) {
    setChildren((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  async function deleteSearch(id: string) {
    await supabase.from('saved_searches').delete().eq('id', id)
    setSearches((prev) => prev.filter((s) => s.id !== id))
  }
  async function toggleAlert(id: string, current: boolean) {
    await supabase.from('saved_searches').update({ alert_on_new: !current }).eq('id', id)
    setSearches((prev) => prev.map((s) => (s.id === id ? { ...s, alert_on_new: !current } : s)))
  }

  async function openPortal(type: 'provider' | 'parent') {
    setPortalLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) return
      const url = await createPortalSession(token, type)
      if (url) window.location.href = url
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    router.push('/')
  }

  if (sessionLoading || loading) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">Loading…</div>
  }
  if (!session) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Account</h1>
          <p className="text-gray-500 text-sm">{user?.email}</p>
        </div>
        <button onClick={handleSignOut} className="text-sm text-red-500 hover:text-red-700">
          Sign out
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
      {savedAt && Date.now() - savedAt < 4000 && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Saved.
        </div>
      )}

      {/* Profile form */}
      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              placeholder="How parents see you on reviews"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Home postcode</label>
              <input
                type="text"
                value={homePostcode}
                onChange={(e) => setHomePostcode(e.target.value.toUpperCase())}
                maxLength={16}
                placeholder="SW11 1AA"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work postcode</label>
              <input
                type="text"
                value={workPostcode}
                onChange={(e) => setWorkPostcode(e.target.value.toUpperCase())}
                maxLength={16}
                placeholder="EC2A 1AA"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Avatar URL</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              maxLength={500}
              placeholder="https://…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Children</label>
              <button
                type="button"
                onClick={addChild}
                className="text-xs text-blue-600 hover:underline"
              >
                + Add child
              </button>
            </div>
            {children.length === 0 && (
              <p className="text-xs text-gray-500">No children added yet.</p>
            )}
            <div className="space-y-2">
              {children.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={c.name || ''}
                    onChange={(e) => updateChild(idx, { name: e.target.value })}
                    placeholder="Name"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    value={c.age_months ?? 0}
                    onChange={(e) => updateChild(idx, { age_months: Number(e.target.value) })}
                    min={0}
                    max={120}
                    placeholder="Age (months)"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeChild(idx)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">Email me about new matching nurseries</span>
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>

      {/* Subscription */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>

        {/* Parent subscription */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Parent plan</h3>
          {subscription?.parent && subscription.parent.tier !== 'free' ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full mr-2">
                  {subscription.parent.tier.charAt(0).toUpperCase() + subscription.parent.tier.slice(1)}
                </span>
                <span className="text-sm text-gray-500">
                  {subscription.parent.cancel_at_period_end
                    ? 'Cancels'
                    : 'Renews'}{' '}
                  {subscription.parent.current_period_end
                    ? new Date(subscription.parent.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                    : ''}
                </span>
              </div>
              <button
                onClick={() => openPortal('parent')}
                disabled={portalLoading}
                className="text-sm text-indigo-600 font-medium hover:underline disabled:opacity-50"
              >
                Manage
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Free plan</span>
              <Link href="/pricing" className="text-sm text-indigo-600 font-medium hover:underline">
                Upgrade
              </Link>
            </div>
          )}
        </div>

        {/* Provider subscription */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Provider plan</h3>
          {subscription?.provider && subscription.provider.tier !== 'free' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full mr-2">
                    {subscription.provider.tier.charAt(0).toUpperCase() + subscription.provider.tier.slice(1)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {subscription.provider.cancel_at_period_end
                      ? 'Cancels'
                      : 'Renews'}{' '}
                    {subscription.provider.current_period_end
                      ? new Date(subscription.provider.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                      : ''}
                  </span>
                </div>
                <button
                  onClick={() => openPortal('provider')}
                  disabled={portalLoading}
                  className="text-sm text-indigo-600 font-medium hover:underline disabled:opacity-50"
                >
                  Manage
                </button>
              </div>
              {/* Enquiry credits */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Enquiry credits used</span>
                  <span className="font-medium text-gray-900">
                    {subscription.provider.enquiry_credits_used} / {subscription.provider.enquiry_credits}
                  </span>
                </div>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        subscription.provider.enquiry_credits > 0
                          ? (subscription.provider.enquiry_credits_used / subscription.provider.enquiry_credits) * 100
                          : 0
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Free plan</span>
              <Link href="/pricing" className="text-sm text-indigo-600 font-medium hover:underline">
                Upgrade
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Preferences sync */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Preferences</h2>
        <p className="text-sm text-gray-600 mb-4">
          {hasActivePreferences(prefs)
            ? 'You have customised your search preferences. Sync them to your account so they follow you across devices.'
            : 'No custom preferences set. Adjust them in the search filters, then sync.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={syncPrefsToServer}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Sync preferences to account
          </button>
          {profile?.preferences && (
            <span className="text-xs text-gray-500">Last synced version on file</span>
          )}
        </div>
      </div>

      {/* Saved searches */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Saved Searches</h2>
        {searches.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No saved searches yet. When you search for nurseries, you can save your search here.
          </p>
        ) : (
          <div className="space-y-3">
            {searches.map((search) => (
              <div
                key={search.id}
                className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {search.name || search.postcode} — {search.radius_km}km
                  </p>
                  <p className="text-xs text-gray-500">
                    {search.grade_filter && `${search.grade_filter} only`}
                    {search.funded_2yr && ' · 2yr funded'}
                    {search.funded_3yr && ' · 3-4yr funded'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleAlert(search.id, search.alert_on_new)}
                    className={`text-xs px-2 py-1 rounded-full ${
                      search.alert_on_new
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {search.alert_on_new ? 'Alerts on' : 'Alerts off'}
                  </button>
                  <Link
                    href={`/search?postcode=${search.postcode}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Run
                  </Link>
                  <button
                    onClick={() => deleteSearch(search.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
        <div className="flex gap-4">
          <Link href="/shortlist" className="text-sm text-blue-600 hover:underline">
            Your Shortlist
          </Link>
          <Link href="/search" className="text-sm text-blue-600 hover:underline">
            Search Nurseries
          </Link>
        </div>
      </div>
    </div>
  )
}
