'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import GradeBadge from './GradeBadge'
import { Nursery, AreaSummary, getAreaSummary, postcodeDistrict } from '@/lib/api'

interface Props {
  nurseries: Nursery[]
  onRemove: (urn: string) => void
}

const GRADE_RANK: Record<string, number> = {
  'Outstanding': 4,
  'Good': 3,
  'Requires Improvement': 2,
  'Inadequate': 1,
}

function bestGradeUrns(nurseries: Nursery[]): Set<string> {
  let best = 0
  for (const n of nurseries) {
    const rank = GRADE_RANK[n.ofsted_overall_grade || ''] || 0
    if (rank > best) best = rank
  }
  if (best === 0) return new Set()
  return new Set(
    nurseries
      .filter(n => (GRADE_RANK[n.ofsted_overall_grade || ''] || 0) === best)
      .map(n => n.urn)
  )
}

function bestNumberUrns(
  nurseries: Nursery[],
  field: keyof Nursery,
  mode: 'highest' | 'lowest'
): Set<string> {
  const values = nurseries
    .map(n => ({ urn: n.urn, val: n[field] as number | null }))
    .filter(v => v.val != null && v.val > 0)
  if (values.length === 0) return new Set()

  const best = mode === 'highest'
    ? Math.max(...values.map(v => v.val!))
    : Math.min(...values.map(v => v.val!))

  return new Set(values.filter(v => v.val === best).map(v => v.urn))
}

function bestDateUrns(nurseries: Nursery[]): Set<string> {
  const values = nurseries
    .map(n => ({ urn: n.urn, date: n.last_inspection_date }))
    .filter(v => v.date != null)
  if (values.length === 0) return new Set()

  const best = values.reduce((a, b) =>
    new Date(a.date!) > new Date(b.date!) ? a : b
  )
  const bestDate = best.date!

  return new Set(values.filter(v => v.date === bestDate).map(v => v.urn))
}

function bestBoolUrns(nurseries: Nursery[], field: keyof Nursery): Set<string> {
  // false is better (no warning / no enforcement)
  const hasFalse = nurseries.some(n => n[field] === false)
  if (!hasFalse) return new Set()
  return new Set(nurseries.filter(n => n[field] === false).map(n => n.urn))
}

function cellClass(isHighlighted: boolean): string {
  return isHighlighted
    ? 'bg-green-50 border-green-200'
    : ''
}

function gbp(n: number | null | undefined) {
  if (n == null) return null
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `£${Math.round(n / 1000)}k`
  return `£${n}`
}

export default function ComparisonTable({ nurseries, onRemove }: Props) {
  const [areas, setAreas] = useState<Record<string, AreaSummary | null>>({})

  useEffect(() => {
    const districts = Array.from(new Set(
      nurseries.map(n => postcodeDistrict(n.postcode)).filter(Boolean) as string[]
    ))
    Promise.all(districts.map(d =>
      getAreaSummary(d).then(a => [d, a] as const).catch(() => [d, null] as const)
    )).then(pairs => setAreas(Object.fromEntries(pairs)))
  }, [nurseries])

  function areaFor(n: Nursery): AreaSummary | null {
    const d = postcodeDistrict(n.postcode)
    return d ? areas[d] || null : null
  }

  const hasAnyAreaData = nurseries.some(n => {
    const a = areaFor(n)
    return a && (a.family_score != null || a.avg_sale_price_all != null)
  })

  if (nurseries.length === 0) return null

  const gradeWinners = bestGradeUrns(nurseries)
  const inspectionWinners = bestDateUrns(nurseries)
  const warningWinners = bestBoolUrns(nurseries, 'inspection_date_warning')
  const enforcementWinners = bestBoolUrns(nurseries, 'enforcement_notice')
  const placesWinners = bestNumberUrns(nurseries, 'total_places', 'highest')
  const funded2yrWinners = bestNumberUrns(nurseries, 'places_funded_2yr', 'highest')
  const funded34yrWinners = bestNumberUrns(nurseries, 'places_funded_3_4yr', 'highest')
  const feeWinners = bestNumberUrns(nurseries, 'fee_avg_monthly', 'lowest')

  const colWidth = nurseries.length <= 2 ? 'min-w-[280px]' :
                   nurseries.length <= 3 ? 'min-w-[240px]' :
                   'min-w-[200px]'

  return (
    <div className="overflow-x-auto snap-x snap-mandatory">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[140px]">
              Attribute
            </th>
            {nurseries.map(n => (
              <th key={n.urn} className={`snap-start border-b border-gray-200 p-3 text-left ${colWidth}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/nursery/${n.urn}`}
                      className="font-semibold text-gray-900 hover:text-blue-600 text-sm line-clamp-2 block"
                    >
                      {n.name}
                    </Link>
                    <div className="mt-1">
                      <GradeBadge grade={n.ofsted_overall_grade} size="sm" />
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(n.urn)}
                    className="flex-shrink-0 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full w-6 h-6 flex items-center justify-center text-sm transition-colors"
                    title="Remove from comparison"
                  >
                    &times;
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Ofsted Grade */}
          <Row label="Ofsted Grade">
            {nurseries.map(n => (
              <td key={n.urn} className={`border-b border-gray-200 p-3 ${cellClass(gradeWinners.has(n.urn))}`}>
                <GradeBadge grade={n.ofsted_overall_grade} size="sm" />
              </td>
            ))}
          </Row>

          {/* Last Inspection */}
          <Row label="Last Inspection">
            {nurseries.map(n => (
              <td key={n.urn} className={`border-b border-gray-200 p-3 text-sm ${cellClass(inspectionWinners.has(n.urn))}`}>
                {n.last_inspection_date
                  ? new Date(n.last_inspection_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                  : <span className="text-gray-400">N/A</span>
                }
                {n.inspection_date_warning && (
                  <span className="ml-1 text-amber-500" title="Over 4 years old">&#9888;</span>
                )}
              </td>
            ))}
          </Row>

          {/* Enforcement Notice */}
          <Row label="Enforcement Notice">
            {nurseries.map(n => (
              <td key={n.urn} className={`border-b border-gray-200 p-3 text-sm ${cellClass(enforcementWinners.has(n.urn))}`}>
                {n.enforcement_notice
                  ? <span className="text-red-600 font-medium">Yes</span>
                  : <span className="text-green-600">None</span>
                }
              </td>
            ))}
          </Row>

          {/* Total Places */}
          <Row label="Total Places">
            {nurseries.map(n => (
              <td key={n.urn} className={`border-b border-gray-200 p-3 text-sm font-medium ${cellClass(placesWinners.has(n.urn))}`}>
                {n.total_places ?? <span className="text-gray-400">N/A</span>}
              </td>
            ))}
          </Row>

          {/* 2yr Funded */}
          <Row label="2yr Funded Places">
            {nurseries.map(n => (
              <td key={n.urn} className={`border-b border-gray-200 p-3 text-sm ${cellClass(funded2yrWinners.has(n.urn))}`}>
                {n.places_funded_2yr && n.places_funded_2yr > 0
                  ? <span className="text-green-700 font-medium">{n.places_funded_2yr} places</span>
                  : <span className="text-gray-400">None</span>
                }
              </td>
            ))}
          </Row>

          {/* 3-4yr Funded */}
          <Row label="3-4yr Funded Places">
            {nurseries.map(n => (
              <td key={n.urn} className={`border-b border-gray-200 p-3 text-sm ${cellClass(funded34yrWinners.has(n.urn))}`}>
                {n.places_funded_3_4yr && n.places_funded_3_4yr > 0
                  ? <span className="text-green-700 font-medium">{n.places_funded_3_4yr} places</span>
                  : <span className="text-gray-400">None</span>
                }
              </td>
            ))}
          </Row>

          {/* Avg Monthly Fee */}
          <Row label="Avg Monthly Fee">
            {nurseries.map(n => (
              <td key={n.urn} className={`border-b border-gray-200 p-3 text-sm ${cellClass(feeWinners.has(n.urn))}`}>
                {n.fee_avg_monthly && n.fee_report_count >= 3
                  ? <span className="font-medium">&pound;{n.fee_avg_monthly}/mo</span>
                  : <span className="text-gray-400">No data</span>
                }
              </td>
            ))}
          </Row>

          {/* Address */}
          <Row label="Address">
            {nurseries.map(n => (
              <td key={n.urn} className="border-b border-gray-200 p-3 text-sm text-gray-600">
                <div>{n.address_line1}</div>
                <div>{n.town}</div>
                <div className="font-medium">{n.postcode}</div>
              </td>
            ))}
          </Row>

          {/* Local Authority */}
          <Row label="Local Authority">
            {nurseries.map(n => (
              <td key={n.urn} className="border-b border-gray-200 p-3 text-sm text-gray-600">
                {n.local_authority || <span className="text-gray-400">N/A</span>}
              </td>
            ))}
          </Row>

          {/* Distance (if any nursery has it) */}
          {nurseries.some(n => n.distance_km != null) && (
            <Row label="Distance">
              {nurseries.map(n => (
                <td key={n.urn} className="border-b border-gray-200 p-3 text-sm text-gray-600">
                  {n.distance_km != null
                    ? `${n.distance_km.toFixed(1)} km`
                    : <span className="text-gray-400">N/A</span>
                  }
                </td>
              ))}
            </Row>
          )}

          {hasAnyAreaData && (
            <>
              <Row label="Area Family Score">
                {nurseries.map(n => {
                  const a = areaFor(n)
                  return (
                    <td key={n.urn} className="border-b border-gray-200 p-3 text-sm">
                      {a?.family_score != null
                        ? <span className="font-medium">{a.family_score}/10</span>
                        : <span className="text-gray-400">No data</span>}
                    </td>
                  )
                })}
              </Row>
              <Row label="Area Avg Sold Price">
                {nurseries.map(n => {
                  const a = areaFor(n)
                  return (
                    <td key={n.urn} className="border-b border-gray-200 p-3 text-sm">
                      {a?.avg_sale_price_all != null
                        ? <span className="font-medium">{gbp(a.avg_sale_price_all)}</span>
                        : <span className="text-gray-400">No data</span>}
                    </td>
                  )
                })}
              </Row>
            </>
          )}

          {/* View Full Profile links */}
          <Row label="">
            {nurseries.map(n => (
              <td key={n.urn} className="p-3">
                <Link
                  href={`/nursery/${n.urn}`}
                  className="inline-block px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View full profile
                </Link>
              </td>
            ))}
          </Row>
        </tbody>
      </table>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="hover:bg-gray-50/50">
      <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
        {label}
      </td>
      {children}
    </tr>
  )
}
