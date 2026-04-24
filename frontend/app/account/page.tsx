'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'
import ConfirmModal from '@/components/ConfirmModal'
import { getProfile, updateProfile, getSubscription, createPortalSession, getAuthToken, exportMyData, deleteMyAccount, getNotificationPreferences, updateNotificationPreferences, type Profile, type ProfileChild, type SubscriptionInfo, type NotificationPreferences } from '@/lib/api'
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
  const { session, user, role, loading: sessionLoading, signOut } = useSession()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null)
  const [notifLoading, setNotifLoading] = useState(true)
  const [notifSaving, setNotifSaving] = useState(false)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0) // 0=hidden, 1=first confirm, 2=second confirm
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Form state mirrors profile
  const [displayName, setDisplayName] = useState('')
  const [homePostcode, setHomePostcode] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [emailAlerts, setEmailAlerts] = useState(false)
  const [children, setChildren] = useState<ProfileChild[]>([])
  const [emailWeeklyDigest, setEmailWeeklyDigest] = useState(true)
  const [emailNewNurseries, setEmailNewNurseries] = useState(true)
  const [emailMarketing, setEmailMarketing] = useState(true)

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
        setAvatarUrl(p.avatar_url || '')
        setEmailAlerts(!!p.email_alerts)
        setChildren(Array.isArray(p.children) ? p.children.map(c => ({ ...c, id: c.id || crypto.randomUUID() })) : [])
        setEmailWeeklyDigest(p.email_weekly_digest !== false)
        setEmailNewNurseries(p.email_new_nurseries !== false)
        setEmailMarketing(p.email_marketing !== false)
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
      // Load notification preferences
      try {
        const np = await getNotificationPreferences(token)
        setNotifPrefs(np)
      } catch {
        // Non-critical — table may not exist yet
      }
      setNotifLoading(false)
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
        avatar_url: avatarUrl || null,
        email_alerts: emailAlerts,
        children,
        email_weekly_digest: emailWeeklyDigest,
        email_new_nurseries: emailNewNurseries,
        email_marketing: emailMarketing,
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
    setChildren((prev) => [...prev, { id: crypto.randomUUID(), name: '', age_months: 0 }])
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

  function handleNotifToggle(field: keyof NotificationPreferences, value: boolean) {
    if (!session || !notifPrefs) return
    const updated = { ...notifPrefs, [field]: value }
    setNotifPrefs(updated)

    // Debounced save
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      setNotifSaving(true)
      try {
        const result = await updateNotificationPreferences(session.access_token, { [field]: value })
        setNotifPrefs(result)
      } catch (err: any) {
        setError(err?.message || 'Failed to save notification preference')
        // Revert optimistic update
        setNotifPrefs((prev) => prev ? { ...prev, [field]: !value } : prev)
      } finally {
        setNotifSaving(false)
      }
    }, 500)
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

          {/* Provider quick links */}
          {role === 'provider' && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <p className="text-sm font-medium text-indigo-900 mb-2">Nursery Management</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/provider" className="text-sm text-indigo-700 hover:text-indigo-900 underline">Dashboard</Link>
                <span className="text-indigo-300">|</span>
                <Link href="/provider/onboarding" className="text-sm text-indigo-700 hover:text-indigo-900 underline">Edit Nursery</Link>
                <span className="text-indigo-300">|</span>
                <Link href="/provider/billing" className="text-sm text-indigo-700 hover:text-indigo-900 underline">Billing</Link>
                <span className="text-indigo-300">|</span>
                <Link href="/provider/enquiries" className="text-sm text-indigo-700 hover:text-indigo-900 underline">Enquiries</Link>
              </div>
            </div>
          )}

          {role !== 'provider' && (
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
          )}

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

          {role !== 'provider' && (
            <>
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
                    <div key={c.id || idx} className="flex items-center gap-2">
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
            </>
          )}
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

      {/* Email Preferences */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Preferences</h2>
        <p className="text-sm text-gray-500 mb-4">
          Choose which emails you would like to receive from NurseryMatch.
        </p>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={emailWeeklyDigest}
              onChange={(e) => setEmailWeeklyDigest(e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Weekly digest</span>
              <p className="text-xs text-gray-500">New and updated nurseries near your home postcode, sent every Monday.</p>
            </div>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={emailNewNurseries}
              onChange={(e) => setEmailNewNurseries(e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">New nurseries near me</span>
              <p className="text-xs text-gray-500">Get notified when a new nursery is added in your area.</p>
            </div>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={emailMarketing}
              onChange={(e) => setEmailMarketing(e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Tips and updates</span>
              <p className="text-xs text-gray-500">Occasional emails with nursery-finding tips, new features and helpful guides.</p>
            </div>
          </label>
        </div>
        <p className="mt-4 text-xs text-gray-400">Changes are saved when you click &quot;Save profile&quot; above.</p>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
          {notifSaving && (
            <span className="text-xs text-gray-400">Saving...</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Fine-tune which email notifications you receive. Changes save automatically.
        </p>
        {notifLoading ? (
          <div className="py-4 text-center text-gray-400 text-sm">Loading preferences...</div>
        ) : notifPrefs ? (
          <div className="space-y-4">
            {([
              {
                field: 'email_new_review' as const,
                label: 'New reviews',
                description: 'Get notified when someone posts a review on a nursery you have reviewed or shortlisted.',
              },
              {
                field: 'email_qa_answer' as const,
                label: 'Q&A answers',
                description: 'Get notified when someone answers a question you asked on a nursery profile.',
              },
              {
                field: 'email_saved_search_alert' as const,
                label: 'Saved search alerts',
                description: 'Get notified when new nurseries match one of your saved searches.',
              },
              {
                field: 'email_ofsted_change' as const,
                label: 'Ofsted rating changes',
                description: 'Get notified when a nursery you follow has its Ofsted rating updated.',
              },
              {
                field: 'email_weekly_digest' as const,
                label: 'Weekly digest',
                description: 'A Monday morning summary of new nurseries, Ofsted changes, Q&A answers and reviews.',
              },
              {
                field: 'email_marketing' as const,
                label: 'Tips and product updates',
                description: 'Occasional emails with nursery-finding tips, new features and helpful guides.',
              },
            ]).map(({ field, label, description }) => (
              <label key={field} className="flex items-start gap-3 cursor-pointer">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={!!notifPrefs[field]}
                    onChange={(e) => handleNotifToggle(field, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-900">{label}</span>
                  <p className="text-xs text-gray-500">{description}</p>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Unable to load notification preferences.</p>
        )}
      </div>

      {/* Subscription */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>

        {/* Parent — free for all */}
        {role === 'customer' && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">All parent features are free — no subscription needed.</p>
          </div>
        )}

        {/* Provider subscription — only visible to providers and admins */}
        {(role === 'provider' || role === 'admin') && <div>
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
        </div>}
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

      {/* GDPR — Data & Account */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Your Data</h2>
        <p className="text-sm text-gray-500 mb-4">
          Under UK GDPR you have the right to export or delete all your data.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={async () => {
              if (!session) return
              try {
                const data = await exportMyData(session.access_token)
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'my-nurserymatch-data.json'
                a.click()
                URL.revokeObjectURL(url)
              } catch (err: any) {
                setError(err?.message || 'Export failed')
              }
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            Download my data
          </button>
          <button
            onClick={() => setDeleteStep(1)}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 border border-red-200"
          >
            Delete my account
          </button>
          <ConfirmModal
            open={deleteStep === 1}
            title="Delete your account?"
            message="Are you sure you want to permanently delete your account and all associated data? This cannot be undone."
            confirmLabel="Continue"
            variant="danger"
            onConfirm={() => setDeleteStep(2)}
            onCancel={() => setDeleteStep(0)}
          />
          <ConfirmModal
            open={deleteStep === 2}
            title="Final confirmation"
            message="This will delete your profile, reviews, claims, messages, saved searches, and all other data. Proceed?"
            confirmLabel="Delete permanently"
            variant="danger"
            onConfirm={async () => {
              setDeleteStep(0)
              if (!session) return
              try {
                await deleteMyAccount(session.access_token)
                await signOut()
                router.push('/?deleted=1')
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Deletion failed')
              }
            }}
            onCancel={() => setDeleteStep(0)}
          />
        </div>
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
