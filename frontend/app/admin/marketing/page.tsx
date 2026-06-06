'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, API_URL } from '@/lib/api'

// --- Types ---

type ContentType = 'social_post' | 'blog_outline' | 'google_ad_copy'
type Platform = 'instagram' | 'facebook' | 'twitter' | 'linkedin'
type Tone = 'professional' | 'friendly' | 'urgent' | 'educational'

interface GeneratedContent {
  id: string
  content_type: ContentType
  platform: Platform | null
  topic: string
  tone: Tone
  content: string
  created_at: string
}

interface BufferProfile {
  id: string
  service: string
  service_username: string
  avatar_url: string | null
  connected: boolean
}

interface SocialPost {
  id: string
  text: string
  profile_ids: string[]
  platforms: string[]
  status: 'posted' | 'scheduled' | 'failed'
  scheduled_at: string | null
  posted_at: string | null
  impressions: number
  engagement: number
  created_at: string
}

interface AdCampaign {
  id: string
  name: string
  status: 'active' | 'paused' | 'ended' | 'pending'
  daily_budget: number
  keywords: string[]
  headlines: string[]
  descriptions: string[]
  impressions: number
  clicks: number
  conversions: number
  spend: number
  created_at: string
}

const TABS = [
  { key: 'content', label: 'AI Content Generator' },
  { key: 'social', label: 'Social Media' },
  { key: 'ads', label: 'Google Ads' },
] as const

type TabKey = (typeof TABS)[number]['key']

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'social_post', label: 'Social Post' },
  { value: 'blog_outline', label: 'Blog Outline' },
  { value: 'google_ad_copy', label: 'Google Ad Copy' },
]

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'linkedin', label: 'LinkedIn' },
]

const TONES: { value: Tone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'educational', label: 'Educational' },
]

const PLATFORM_BADGES: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-800',
  facebook: 'bg-blue-100 text-blue-800',
  twitter: 'bg-sky-100 text-sky-800',
  linkedin: 'bg-indigo-100 text-indigo-800',
}

const STATUS_BADGES: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  posted: 'bg-green-100 text-green-800',
  scheduled: 'bg-amber-100 text-amber-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  paused: 'bg-red-100 text-red-800',
  ended: 'bg-gray-100 text-gray-600',
}

export default function AdminMarketingPage() {
  const { role } = useSession()
  const [activeTab, setActiveTab] = useState<TabKey>('content')

  if (role !== 'admin') return null

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Marketing Hub</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'content' && <ContentGeneratorTab />}
      {activeTab === 'social' && <SocialMediaTab />}
      {activeTab === 'ads' && <GoogleAdsTab />}
    </div>
  )
}

// ========================
// Tab 1: AI Content Generator
// ========================

function ContentGeneratorTab() {
  const [contentType, setContentType] = useState<ContentType>('social_post')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState<Tone>('professional')
  const [generating, setGenerating] = useState(false)
  const [generatedText, setGeneratedText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [postingToBuffer, setPostingToBuffer] = useState(false)
  const [postSuccess, setPostSuccess] = useState(false)
  const [bufferConnected, setBufferConnected] = useState(false)
  const [bufferProfiles, setBufferProfiles] = useState<BufferProfile[]>([])
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])
  const [postImageUrl, setPostImageUrl] = useState('')
  const [recentContent, setRecentContent] = useState<GeneratedContent[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  useEffect(() => {
    fetchRecentContent()
    checkBufferConnection()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function authHeaders(): Promise<HeadersInit> {
    const token = await getAuthToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  async function checkBufferConnection() {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_URL}/api/v1/admin/marketing/social/profiles`, { headers })
      if (res.ok) {
        const data = await res.json()
        const profiles = Array.isArray(data) ? data : data.data ?? data.profiles ?? []
        setBufferProfiles(profiles)
        setBufferConnected(profiles.length > 0)
      }
    } catch {
      // Buffer not connected
    }
  }

  function togglePostProfile(id: string) {
    setSelectedProfiles((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  async function fetchRecentContent() {
    try {
      setLoadingRecent(true)
      const headers = await authHeaders()
      const res = await fetch(`${API_URL}/api/v1/admin/marketing/content`, { headers })
      if (!res.ok) throw new Error('Failed to load recent content')
      const data = await res.json()
      setRecentContent(Array.isArray(data) ? data : data.data ?? data.content ?? [])
    } catch {
      // Silently fail for recent content list
    } finally {
      setLoadingRecent(false)
    }
  }

  async function handleGenerate(e: FormEvent) {
    e.preventDefault()
    if (!topic.trim()) {
      setError('Please enter a topic or brief')
      return
    }
    setGenerating(true)
    setError(null)
    setGeneratedText('')
    setCopied(false)
    try {
      const headers = await authHeaders()
      const body: Record<string, string> = {
        content_type: contentType,
        topic: topic.trim(),
        tone,
      }
      if (contentType === 'social_post') {
        body.platform = platform
      }
      const res = await fetch(`${API_URL}/api/v1/admin/marketing/generate-content`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate content')
      }
      const data = await res.json()
      setGeneratedText(data.content || data.text || '')
      fetchRecentContent()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generatedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Failed to copy to clipboard')
    }
  }

  async function handlePostToBuffer() {
    if (!generatedText.trim()) return
    if (selectedProfiles.length === 0) {
      setError('Select at least one channel to post to')
      return
    }
    setPostingToBuffer(true)
    setPostSuccess(false)
    setError(null)
    try {
      const headers = await authHeaders()
      const body: Record<string, unknown> = {
        text: generatedText,
        profile_ids: selectedProfiles,
        schedule: false,
      }
      if (postImageUrl.trim()) {
        body.image_url = postImageUrl.trim()
      }
      const res = await fetch(`${API_URL}/api/v1/admin/marketing/social/post`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to post to Buffer')
      }
      setPostSuccess(true)
      setSelectedProfiles([])
      setPostImageUrl('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setPostingToBuffer(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Generator form */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Content</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content Type
              </label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as ContentType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                {CONTENT_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>

            {contentType === 'social_post' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Platform
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topic / Brief
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder='e.g. "funded childcare hours", "nursery costs 2026"'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </form>
      </div>

      {/* Generated output */}
      {generatedText && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Generated Content</h2>
          <textarea
            value={generatedText}
            onChange={(e) => setGeneratedText(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
          />
          {/* Post-to-Buffer (social posts only) */}
          {contentType === 'social_post' && bufferConnected && (
            <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Post to channels
                </label>
                <div className="flex flex-wrap gap-2">
                  {bufferProfiles.map((profile) => (
                    <label
                      key={profile.id}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer transition text-sm ${
                        selectedProfiles.includes(profile.id)
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProfiles.includes(profile.id)}
                        onChange={() => togglePostProfile(profile.id)}
                        className="sr-only"
                      />
                      {profile.service_username}
                      <span className="text-xs text-gray-400">({profile.service})</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL{' '}
                  <span className="text-gray-400 font-normal">
                    (optional — required for Instagram)
                  </span>
                </label>
                <input
                  type="url"
                  value={postImageUrl}
                  onChange={(e) => setPostImageUrl(e.target.value)}
                  placeholder="https://nurserymatch.com/instagram/your-image.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
            >
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
            {contentType === 'social_post' && (
              <button
                onClick={handlePostToBuffer}
                disabled={!bufferConnected || postingToBuffer || selectedProfiles.length === 0}
                title={
                  !bufferConnected
                    ? 'Buffer is not connected. Configure it in the Social Media tab.'
                    : selectedProfiles.length === 0
                      ? 'Select at least one channel'
                      : ''
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {postingToBuffer ? 'Posting...' : 'Post to Buffer'}
              </button>
            )}
            {postSuccess && (
              <span className="text-sm text-green-600 font-medium">Posted to Buffer ✓</span>
            )}
          </div>
        </div>
      )}

      {/* Recent generated content */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Generated Content</h2>
        {loadingRecent ? (
          <div className="text-center text-gray-500 py-6">Loading...</div>
        ) : recentContent.length === 0 ? (
          <div className="text-center text-gray-500 py-6">
            No content generated yet. Use the form above to create your first piece.
          </div>
        ) : (
          <div className="space-y-3">
            {recentContent.map((item) => (
              <div
                key={item.id}
                className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full font-medium">
                    {CONTENT_TYPES.find((c) => c.value === item.content_type)?.label || item.content_type}
                  </span>
                  {item.platform && (
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                        PLATFORM_BADGES[item.platform] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.platform}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(item.created_at).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium text-gray-700">Topic:</span> {item.topic}
                </p>
                <p className="text-sm text-gray-700 line-clamp-3">{item.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ========================
// Tab 2: Social Media
// ========================

function SocialMediaTab() {
  const [profiles, setProfiles] = useState<BufferProfile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [bufferConfigured, setBufferConfigured] = useState(true)
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New post form
  const [postText, setPostText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    fetchProfiles()
    fetchPosts()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function authHeaders(): Promise<HeadersInit> {
    const token = await getAuthToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  async function fetchProfiles() {
    try {
      setLoadingProfiles(true)
      const headers = await authHeaders()
      const res = await fetch(`${API_URL}/api/v1/admin/marketing/social/profiles`, { headers })
      if (res.status === 404 || res.status === 501) {
        setBufferConfigured(false)
        return
      }
      if (!res.ok) throw new Error('Failed to load profiles')
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.data ?? data.profiles ?? []
      setProfiles(list)
      if (list.length === 0) {
        setBufferConfigured(false)
      }
    } catch {
      setBufferConfigured(false)
    } finally {
      setLoadingProfiles(false)
    }
  }

  async function fetchPosts() {
    try {
      setLoadingPosts(true)
      const headers = await authHeaders()
      const res = await fetch(`${API_URL}/api/v1/admin/marketing/social/posts`, { headers })
      if (!res.ok) return
      const data = await res.json()
      setPosts(Array.isArray(data) ? data : data.data ?? data.posts ?? [])
    } catch {
      // Silently fail
    } finally {
      setLoadingPosts(false)
    }
  }

  function toggleProfile(id: string) {
    setSelectedProfiles((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  async function handlePost(schedule: boolean) {
    if (!postText.trim()) {
      setError('Post text is required')
      return
    }
    if (selectedProfiles.length === 0) {
      setError('Select at least one profile')
      return
    }
    setPosting(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const body: Record<string, unknown> = {
        text: postText.trim(),
        profile_ids: selectedProfiles,
        schedule,
      }
      if (imageUrl.trim()) {
        body.image_url = imageUrl.trim()
      }
      if (schedule && scheduleDate && scheduleTime) {
        body.scheduled_at = `${scheduleDate}T${scheduleTime}:00.000Z`
      }
      const res = await fetch(`${API_URL}/api/v1/admin/marketing/social/post`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to post')
      }
      setPostText('')
      setImageUrl('')
      setSelectedProfiles([])
      setScheduleDate('')
      setScheduleTime('')
      fetchPosts()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Buffer profiles */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Connected Profiles</h2>

        {loadingProfiles ? (
          <div className="text-center text-gray-500 py-6">Loading...</div>
        ) : !bufferConfigured ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">
              Buffer is not configured
            </h3>
            <p className="text-sm text-amber-700 mb-3">
              To connect your social media accounts, add your Buffer personal API key to the
              backend environment:
            </p>
            <div className="bg-white border border-amber-200 rounded-lg p-3 font-mono text-xs text-gray-800 space-y-1">
              <p>BUFFER_API_TOKEN=your_buffer_api_key</p>
              <p># optional — defaults to your first organization</p>
              <p>BUFFER_ORGANIZATION_ID=your_organization_id</p>
            </div>
            <p className="text-xs text-amber-600 mt-3">
              Visit{' '}
              <a
                href="https://developers.buffer.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                developers.buffer.com
              </a>{' '}
              to generate a personal API key for the Buffer API.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-3 border border-gray-100 rounded-lg p-3"
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium">
                    {profile.service_username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {profile.service_username}
                  </p>
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                      PLATFORM_BADGES[profile.service] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {profile.service}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New post form (only if Buffer is configured) */}
      {bufferConfigured && profiles.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Post</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Post Text
              </label>
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                rows={4}
                placeholder="What would you like to share?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image URL{' '}
                <span className="text-gray-400 font-normal">
                  (optional — required for Instagram)
                </span>
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://nurserymatch.com/instagram/your-image.png"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <p className="mt-1 text-xs text-gray-400">
                Must be a publicly reachable image (Buffer fetches it). JPG/PNG for Instagram.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Post to profiles
              </label>
              <div className="flex flex-wrap gap-2">
                {profiles.map((profile) => (
                  <label
                    key={profile.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer transition text-sm ${
                      selectedProfiles.includes(profile.id)
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProfiles.includes(profile.id)}
                      onChange={() => toggleProfile(profile.id)}
                      className="sr-only"
                    />
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        selectedProfiles.includes(profile.id)
                          ? 'bg-indigo-500'
                          : 'bg-gray-300'
                      }`}
                    />
                    {profile.service_username}
                    <span className="text-xs text-gray-400">({profile.service})</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule Date (optional)
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule Time (optional)
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handlePost(false)}
                disabled={posting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {posting ? 'Posting...' : 'Post Now'}
              </button>
              <button
                onClick={() => handlePost(true)}
                disabled={posting || !scheduleDate || !scheduleTime}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent posts */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Recent Posts</h2>
        <p className="text-xs text-gray-400 mb-4">
          Engagement metrics (impressions, reach) live in your{' '}
          <a
            href="https://buffer.com/analyze"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            Buffer Analyze dashboard
          </a>{' '}
          — Buffer&apos;s API does not expose per-post analytics yet.
        </p>

        {loadingPosts ? (
          <div className="text-center text-gray-500 py-6">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-center text-gray-500 py-6">No posts yet.</div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm text-gray-800 flex-1 line-clamp-3">{post.text}</p>
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded-full font-semibold capitalize shrink-0 ${
                      STATUS_BADGES[post.status] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {post.platforms.map((p) => (
                    <span
                      key={p}
                      className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium capitalize ${
                        PLATFORM_BADGES[p] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {p}
                    </span>
                  ))}
                  <span className="text-xs text-gray-400 ml-auto">
                    {post.posted_at
                      ? `Posted ${new Date(post.posted_at).toLocaleDateString('en-GB')}`
                      : post.scheduled_at
                        ? `Scheduled ${new Date(post.scheduled_at).toLocaleDateString('en-GB')}`
                        : new Date(post.created_at).toLocaleDateString('en-GB')}
                  </span>
                </div>
                {(post.impressions > 0 || post.engagement > 0) && (
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>
                      <span className="font-medium text-gray-700">
                        {post.impressions.toLocaleString()}
                      </span>{' '}
                      impressions
                    </span>
                    <span>
                      <span className="font-medium text-gray-700">
                        {post.engagement.toLocaleString()}
                      </span>{' '}
                      engagement
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ========================
// Tab 3: Google Ads
// ========================

function GoogleAdsTab() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [adsConfigured, setAdsConfigured] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Campaign form
  const [campaignName, setCampaignName] = useState('')
  const [dailyBudget, setDailyBudget] = useState('')
  const [keywords, setKeywords] = useState('')
  const [headlines, setHeadlines] = useState(['', '', ''])
  const [descriptions, setDescriptions] = useState(['', ''])
  const [creating, setCreating] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    fetchCampaigns()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function authHeaders(): Promise<HeadersInit> {
    const token = await getAuthToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  async function fetchCampaigns() {
    try {
      setLoading(true)
      const headers = await authHeaders()
      const res = await fetch(`${API_URL}/api/v1/admin/marketing/ads/campaigns`, { headers })
      if (res.status === 404 || res.status === 501) {
        setAdsConfigured(false)
        return
      }
      if (!res.ok) throw new Error('Failed to load campaigns')
      const data = await res.json()
      setCampaigns(Array.isArray(data) ? data : data.data ?? data.campaigns ?? [])
    } catch {
      setAdsConfigured(false)
    } finally {
      setLoading(false)
    }
  }

  function validateForm(): string | null {
    if (!campaignName.trim()) return 'Campaign name is required'
    if (!dailyBudget || Number(dailyBudget) <= 0) return 'Daily budget must be greater than 0'
    if (!keywords.trim()) return 'At least one keyword is required'
    const filledHeadlines = headlines.filter((h) => h.trim())
    if (filledHeadlines.length === 0) return 'At least one headline is required'
    for (const h of filledHeadlines) {
      if (h.length > 30) return `Headline "${h.slice(0, 15)}..." exceeds 30 characters`
    }
    const filledDescriptions = descriptions.filter((d) => d.trim())
    if (filledDescriptions.length === 0) return 'At least one description is required'
    for (const d of filledDescriptions) {
      if (d.length > 90) return `Description "${d.slice(0, 20)}..." exceeds 90 characters`
    }
    return null
  }

  async function handleCreateCampaign(e: FormEvent) {
    e.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setCreating(true)
    setFormError(null)
    try {
      const headers = await authHeaders()
      const body = {
        name: campaignName.trim(),
        daily_budget: Number(dailyBudget),
        keywords: keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        headlines: headlines.filter((h) => h.trim()),
        descriptions: descriptions.filter((d) => d.trim()),
      }
      const res = await fetch(`${API_URL}/api/v1/admin/marketing/ads/campaigns`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to create campaign')
      }
      // Reset form
      setCampaignName('')
      setDailyBudget('')
      setKeywords('')
      setHeadlines(['', '', ''])
      setDescriptions(['', ''])
      fetchCampaigns()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCreating(false)
    }
  }

  async function toggleCampaignStatus(campaign: AdCampaign) {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active'
    setTogglingId(campaign.id)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(
        `${API_URL}/api/v1/admin/marketing/ads/campaigns/${campaign.id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: newStatus }),
        }
      )
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to update campaign')
      }
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaign.id ? { ...c, status: newStatus } : c))
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setTogglingId(null)
    }
  }

  function updateHeadline(index: number, value: string) {
    setHeadlines((prev) => prev.map((h, i) => (i === index ? value : h)))
  }

  function updateDescription(index: number, value: string) {
    setDescriptions((prev) => prev.map((d, i) => (i === index ? value : d)))
  }

  if (!adsConfigured && !loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Google Ads</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">
            Google Ads is not configured
          </h3>
          <p className="text-sm text-amber-700 mb-3">
            To manage Google Ads campaigns, set up the following environment variables in your
            backend:
          </p>
          <div className="bg-white border border-amber-200 rounded-lg p-3 font-mono text-xs text-gray-800 space-y-1">
            <p>GOOGLE_ADS_CLIENT_ID=your_client_id</p>
            <p>GOOGLE_ADS_CLIENT_SECRET=your_client_secret</p>
            <p>GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token</p>
            <p>GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token</p>
            <p>GOOGLE_ADS_CUSTOMER_ID=your_customer_id</p>
          </div>
          <p className="text-xs text-amber-600 mt-3">
            Visit{' '}
            <a
              href="https://ads.google.com/home/tools/manager-accounts/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Google Ads Manager
            </a>{' '}
            to set up your account and obtain API credentials.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Create campaign form */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Campaign</h2>

        {formError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>
        )}

        <form onSubmit={handleCreateCampaign} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Campaign Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Nursery Search Campaign"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Daily Budget (GBP) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  &pound;
                </span>
                <input
                  type="number"
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(e.target.value)}
                  placeholder="10.00"
                  min="0"
                  step="0.01"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keywords (comma-separated) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="nursery near me, childcare, early years"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Headlines (max 30 chars each) <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {headlines.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={h}
                    onChange={(e) => updateHeadline(i, e.target.value)}
                    maxLength={30}
                    placeholder={`Headline ${i + 1}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  <span
                    className={`text-xs tabular-nums w-10 text-right ${
                      h.length > 30 ? 'text-red-500 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {h.length}/30
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descriptions (max 90 chars each) <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {descriptions.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={d}
                    onChange={(e) => updateDescription(i, e.target.value)}
                    maxLength={90}
                    placeholder={`Description ${i + 1}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  <span
                    className={`text-xs tabular-nums w-10 text-right ${
                      d.length > 90 ? 'text-red-500 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {d.length}/90
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Campaign'}
          </button>
        </form>
      </div>

      {/* Campaign list */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Campaigns</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No campaigns yet. Create your first one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Daily Budget</th>
                  <th className="px-4 py-3 font-medium text-right">Impressions</th>
                  <th className="px-4 py-3 font-medium text-right">Clicks</th>
                  <th className="px-4 py-3 font-medium text-right">Conversions</th>
                  <th className="px-4 py-3 font-medium text-right">Spend</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                      {campaign.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${
                          STATUS_BADGES[campaign.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      &pound;{campaign.daily_budget.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      {campaign.impressions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      {campaign.clicks.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      {campaign.conversions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      &pound;{campaign.spend.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(campaign.status === 'active' || campaign.status === 'paused') && (
                        <button
                          onClick={() => toggleCampaignStatus(campaign)}
                          disabled={togglingId === campaign.id}
                          className={`text-xs font-medium px-3 py-1 rounded-lg transition disabled:opacity-50 ${
                            campaign.status === 'active'
                              ? 'bg-red-50 text-red-700 hover:bg-red-100'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                        >
                          {togglingId === campaign.id
                            ? '...'
                            : campaign.status === 'active'
                              ? 'Pause'
                              : 'Resume'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
