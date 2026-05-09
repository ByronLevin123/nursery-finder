'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/SessionProvider'
import PostcodeAutocomplete from '@/components/PostcodeAutocomplete'
import Link from 'next/link'
import { API_URL } from '@/lib/api'
import { trackEvent } from '@/lib/analytics'

type Urgency = 'asap' | '3_months' | '6_months' | 'exploring'
type CommuteFrom = 'home' | 'work' | 'both'

interface QuizData {
  child_name: string
  child_dob: string
  urgency: Urgency | ''
  commute_from: CommuteFrom | ''
  commute_postcode: string
  budget_min: number | null
  budget_max: number | null
  budget_flexible: boolean
  priority_order: string[]
  must_haves: string[]
  min_grade: string
}

const URGENCY_OPTIONS: { value: Urgency; label: string; desc: string }[] = [
  { value: 'asap', label: 'ASAP', desc: 'We need a place now' },
  { value: '3_months', label: 'Within 3 months', desc: 'Starting soon' },
  { value: '6_months', label: 'Within 6 months', desc: 'Planning ahead' },
  { value: 'exploring', label: 'Just exploring', desc: 'No rush yet' },
]

const PRIORITY_ITEMS = [
  { id: 'quality', label: 'Quality', desc: 'Ofsted rating and inspection history' },
  { id: 'cost', label: 'Cost', desc: 'Monthly fees and funded hours' },
  { id: 'location', label: 'Location', desc: 'Distance from home or work' },
  { id: 'staff', label: 'Staff', desc: 'Qualifications and ratios' },
  { id: 'availability', label: 'Availability', desc: 'Vacancies and waitlist' },
  { id: 'facilities', label: 'Facilities', desc: 'Outdoor space, meals, extras' },
]

const MUST_HAVE_OPTIONS = [
  { id: 'outdoor_space', label: 'Outdoor space' },
  { id: 'meals_included', label: 'Meals included' },
  { id: 'funded_hours', label: 'Funded hours accepted' },
  { id: 'flexible_sessions', label: 'Flexible sessions' },
  { id: 'forest_school', label: 'Forest school' },
  { id: 'montessori', label: 'Montessori' },
]

function ageInMonths(dob: string): number | null {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  return Math.max(0, months)
}

export default function QuizPage() {
  const router = useRouter()
  const { session, user, loading: sessionLoading } = useSession()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [data, setData] = useState<QuizData>({
    child_name: '',
    child_dob: '',
    urgency: '',
    commute_from: '',
    commute_postcode: '',
    budget_min: 400,
    budget_max: 1500,
    budget_flexible: false,
    priority_order: PRIORITY_ITEMS.map((p) => p.id),
    must_haves: [],
    min_grade: '',
  })

  // Auto-submit pending quiz data when user signs in
  useEffect(() => {
    if (!session || typeof window === 'undefined') return
    const pending = localStorage.getItem('quiz-pending')
    if (!pending) return
    localStorage.removeItem('quiz-pending')
    fetch(`${API_URL}/api/v1/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: pending,
    }).then(() => router.push('/dashboard')).catch(() => {})
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalSteps = 5
  const progress = (step / totalSteps) * 100
  const age = ageInMonths(data.child_dob)

  function updateData(patch: Partial<QuizData>) {
    setData((prev) => ({ ...prev, ...patch }))
  }

  function moveItem(arr: string[], from: number, to: number): string[] {
    const copy = [...arr]
    const [item] = copy.splice(from, 1)
    copy.splice(to, 0, item)
    return copy
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        child_name: data.child_name || null,
        child_dob: data.child_dob || null,
        urgency: data.urgency || null,
        commute_from: data.commute_from || null,
        commute_postcode: data.commute_postcode || null,
        budget_min: data.budget_flexible ? null : data.budget_min,
        budget_max: data.budget_flexible ? null : data.budget_max,
        priority_order: data.priority_order,
        must_haves: data.must_haves,
        min_grade: data.min_grade || null,
      }

      if (!session) {
        localStorage.setItem('quiz-pending', JSON.stringify(body))
        setStep(6)
        return
      }

      const res = await fetch(`${API_URL}/api/v1/quiz/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to save quiz')
      }
      trackEvent('Quiz Complete')
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Step {step} of {totalSteps}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step 1: Child info */}
      {step === 1 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">About your child</h1>
          <p className="text-gray-600 mb-6">This helps us find age-appropriate nurseries.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Child&apos;s name (optional)
              </label>
              <input
                type="text"
                value={data.child_name}
                onChange={(e) => updateData({ child_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. Sophie"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of birth
              </label>
              <input
                type="date"
                value={data.child_dob}
                onChange={(e) => updateData({ child_dob: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
              {age !== null && (
                <p className="text-sm text-indigo-600 mt-1 font-medium">{age} months old</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Urgency */}
      {step === 2 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">When do you need a place?</h1>
          <p className="text-gray-600 mb-6">This helps us prioritise nurseries with availability.</p>

          <div className="space-y-3">
            {URGENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateData({ urgency: opt.value })}
                className={`w-full text-left p-4 rounded-xl border-2 transition ${
                  data.urgency === opt.value
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold text-gray-900">{opt.label}</p>
                <p className="text-sm text-gray-500">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Location */}
      {step === 3 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Where will drop-off be from?</h1>
          <p className="text-gray-600 mb-6">We&apos;ll find nurseries near your commute.</p>

          <div className="space-y-3 mb-6">
            {(['home', 'work', 'both'] as CommuteFrom[]).map((opt) => (
              <button
                key={opt}
                onClick={() => updateData({ commute_from: opt })}
                className={`w-full text-left p-4 rounded-xl border-2 transition ${
                  data.commute_from === opt
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold text-gray-900 capitalize">{opt === 'both' ? 'Both home and work' : opt}</p>
              </button>
            ))}
          </div>

          {data.commute_from && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {data.commute_from === 'both' ? 'Primary postcode' : `${data.commute_from.charAt(0).toUpperCase() + data.commute_from.slice(1)} postcode`}
              </label>
              <PostcodeAutocomplete
                value={data.commute_postcode}
                onChange={(val) => updateData({ commute_postcode: val })}
                placeholder="e.g. SW1A 1AA"
              />
            </div>
          )}
        </div>
      )}

      {/* Step 4: Budget */}
      {step === 4 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">What&apos;s your budget?</h1>
          <p className="text-gray-600 mb-6">Monthly nursery fees vary widely. Set your range.</p>

          <label className="flex items-center gap-2 mb-6">
            <input
              type="checkbox"
              checked={data.budget_flexible}
              onChange={(e) => updateData({ budget_flexible: e.target.checked })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">I&apos;m flexible on budget</span>
          </label>

          {!data.budget_flexible && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Min: {data.budget_min != null ? `\u00A3${data.budget_min}` : ''}/mo</span>
                  <span>Max: {data.budget_max != null ? `\u00A3${data.budget_max}` : ''}/mo</span>
                </div>
                <input
                  type="range"
                  min={400}
                  max={2500}
                  step={50}
                  value={data.budget_min ?? 400}
                  onChange={(e) => updateData({ budget_min: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
                <input
                  type="range"
                  min={400}
                  max={2500}
                  step={50}
                  value={data.budget_max ?? 2500}
                  onChange={(e) => updateData({ budget_max: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 5: Priorities + Must-haves */}
      {step === 5 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Rank your priorities</h1>
          <p className="text-gray-600 mb-6">Drag to reorder. Top = most important.</p>

          <div className="space-y-2 mb-8">
            {data.priority_order.map((id, idx) => {
              const item = PRIORITY_ITEMS.find((p) => p.id === id)
              if (!item) return null
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
                >
                  <span className="text-xs font-bold text-indigo-600 w-5">{idx + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => idx > 0 && updateData({ priority_order: moveItem(data.priority_order, idx, idx - 1) })}
                      disabled={idx === 0}
                      className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      &#9650;
                    </button>
                    <button
                      onClick={() => idx < data.priority_order.length - 1 && updateData({ priority_order: moveItem(data.priority_order, idx, idx + 1) })}
                      disabled={idx === data.priority_order.length - 1}
                      className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      &#9660;
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-3">Must-haves</h2>
          <div className="grid grid-cols-2 gap-2">
            {MUST_HAVE_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                  data.must_haves.includes(opt.id)
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={data.must_haves.includes(opt.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateData({ must_haves: [...data.must_haves, opt.id] })
                    } else {
                      updateData({ must_haves: data.must_haves.filter((h) => h !== opt.id) })
                    }
                  }}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Step 6: Sign in prompt (anonymous users only) */}
      {step === 6 && (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">&#10003;</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quiz complete!</h1>
          <p className="text-gray-600 mb-6">
            Sign in to save your answers and see personalised nursery recommendations.
          </p>
          <Link
            href="/login?next=/quiz"
            className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition"
          >
            Sign in to see matches
          </Link>
          <p className="text-xs text-gray-400 mt-4">Your answers are saved locally and will be submitted when you sign in.</p>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}

      {/* Navigation buttons */}
      {step <= totalSteps && <div className="flex justify-between mt-8">
        {step > 1 ? (
          <button
            onClick={() => setStep(step - 1)}
            className="px-6 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back
          </button>
        ) : (
          <div />
        )}
        {step < totalSteps ? (
          <button
            onClick={() => setStep(step + 1)}
            className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'See my matches'}
          </button>
        )}
      </div>}
    </div>
  )
}
