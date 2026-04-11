'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/SessionProvider'
import Link from 'next/link'
import GradeBadge from '@/components/GradeBadge'
import NearbyPromotions from '@/components/NearbyPromotions'
import { API_URL } from '@/lib/api'

interface DimensionBreakdown {
  [dim: string]: { score: number | null; weight: number }
}

interface Recommendation {
  urn: string
  name: string
  town: string | null
  ofsted_overall_grade: string | null
  fee_avg_monthly: number | null
  distance_km?: number
  fit_score: number
  dimension_breakdown: DimensionBreakdown
  quality_score: number | null
  cost_score: number | null
  availability_score: number | null
  commute_score: number | null
}

function ageInMonths(dob: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()))
}

function matchStrengths(rec: Recommendation): { strengths: string[]; tradeoffs: string[] } {
  const strengths: string[] = []
  const tradeoffs: string[] = []
  const bd = rec.dimension_breakdown || {}

  if (bd.quality?.score != null && bd.quality.score >= 70) strengths.push('Strong Ofsted rating')
  else if (bd.quality?.score != null && bd.quality.score < 50) tradeoffs.push('Below-average quality rating')

  if (bd.cost?.score != null && bd.cost.score >= 70) strengths.push('Good value for money')
  else if (bd.cost?.score != null && bd.cost.score < 40) tradeoffs.push('Higher than average cost')

  if (bd.commute?.score != null && bd.commute.score >= 70) strengths.push('Close to your commute')
  else if (bd.commute?.score != null && bd.commute.score < 40) tradeoffs.push('Further from your commute')

  if (bd.availability?.score != null && bd.availability.score >= 70) strengths.push('Vacancies available')
  else if (bd.availability?.score != null && bd.availability.score < 30) tradeoffs.push('Limited availability')

  return { strengths, tradeoffs }
}

export default function DashboardPage() {
  const router = useRouter()
  const { session, user, loading: sessionLoading } = useSession()
  const [quiz, setQuiz] = useState<Record<string, unknown> | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (sessionLoading) return
    if (!session) {
      router.push('/login?next=/dashboard')
      return
    }

    async function load() {
      try {
        const headers = { Authorization: `Bearer ${session!.access_token}` }

        // Load quiz
        const qRes = await fetch(`${API_URL}/api/v1/quiz/mine`, { headers })
        if (!qRes.ok) throw new Error('Failed to load quiz')
        const qData = await qRes.json()
        if (!qData) {
          router.push('/quiz')
          return
        }
        setQuiz(qData)

        // Load recommendations
        const rRes = await fetch(`${API_URL}/api/v1/recommendations?limit=20`, { headers })
        if (!rRes.ok) throw new Error('Failed to load recommendations')
        const rData = await rRes.json()
        setRecommendations(rData.data || [])

        // Geocode postcode for nearby promotions
        const pc = qData?.commute_postcode as string | null
        if (pc) {
          fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`)
            .then(r => r.json())
            .then(d => {
              if (d.result?.latitude && d.result?.longitude) {
                setGeoCoords({ lat: d.result.latitude, lng: d.result.longitude })
              }
            })
            .catch(() => {})
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [session, sessionLoading, router])

  if (sessionLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mx-auto mb-4" />
          <div className="h-4 bg-gray-200 rounded w-48 mx-auto" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Link href="/quiz" className="text-indigo-600 hover:underline">Retake quiz</Link>
      </div>
    )
  }

  const childName = (quiz?.child_name as string) || 'your child'
  const childAge = ageInMonths(quiz?.child_dob as string | null)
  const postcode = (quiz?.commute_postcode as string) || ''

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Hi {user?.email?.split('@')[0]} — here are your top matches
          {childName !== 'your child' ? ` for ${childName}` : ''}
          {childAge != null ? ` (${childAge}mo)` : ''}
          {postcode ? ` near ${postcode}` : ''}
        </h1>
        <div className="flex gap-3 mt-3">
          <Link
            href="/quiz"
            className="text-sm text-indigo-600 hover:underline"
          >
            Adjust priorities
          </Link>
          <Link
            href="/search"
            className="text-sm text-indigo-600 hover:underline"
          >
            See all matches
          </Link>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No matching nurseries found for your criteria.</p>
          <Link
            href="/quiz"
            className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Adjust your quiz
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec, idx) => {
            const { strengths, tradeoffs } = matchStrengths(rec)
            return (
              <div
                key={rec.urn}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900">{rec.name}</h2>
                      <p className="text-sm text-gray-500">{rec.town}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <GradeBadge grade={rec.ofsted_overall_grade} size="sm" />
                    <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-semibold border border-green-200">
                      {rec.fit_score}% match
                    </span>
                  </div>
                </div>

                {/* Key stats */}
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                  {rec.distance_km != null && (
                    <span>{rec.distance_km.toFixed(1)} km away</span>
                  )}
                  {rec.fee_avg_monthly != null && (
                    <span>~{'\u00A3'}{rec.fee_avg_monthly}/mo</span>
                  )}
                </div>

                {/* Match explanation */}
                {(strengths.length > 0 || tradeoffs.length > 0) && (
                  <div className="mt-3 space-y-1">
                    {strengths.map((s, i) => (
                      <p key={i} className="text-sm text-green-700">
                        <span className="mr-1">&#10003;</span>{s}
                      </p>
                    ))}
                    {tradeoffs.map((t, i) => (
                      <p key={i} className="text-sm text-amber-600">
                        <span className="mr-1">&#9888;</span>{t}
                      </p>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-4">
                  <Link
                    href={`/nursery/${rec.urn}`}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    View profile
                  </Link>
                  <Link
                    href={`/compare?urns=${rec.urn}${recommendations[idx + 1] ? ',' + recommendations[idx + 1].urn : ''}`}
                    className="px-3 py-1.5 text-xs border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50"
                  >
                    Compare
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Activities near you */}
      {geoCoords && (
        <div className="mt-8">
          <NearbyPromotions lat={geoCoords.lat} lng={geoCoords.lng} title="Activities near you" />
        </div>
      )}
    </div>
  )
}
