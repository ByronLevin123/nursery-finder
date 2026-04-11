'use client'

import { useState, useMemo } from 'react'

interface Props {
  feeAvgMonthly: number | null
  feeReportCount: number
  placesFunded2yr: number | null
  placesFunded3_4yr: number | null
  nurseryName: string
}

type AgeGroup = 'under_2' | '2yr' | '3_4yr'
type SessionsPerWeek = 2 | 3 | 4 | 5

// UK government funded hours (2025/26 entitlements)
const FUNDED_HOURS: Record<AgeGroup, { universal: number; extended: number }> = {
  under_2: { universal: 0, extended: 15 }, // 15 hrs from April 2024 for working parents
  '2yr': { universal: 15, extended: 15 },  // 15 hrs universal from April 2024
  '3_4yr': { universal: 15, extended: 30 }, // 15 hrs universal, 30 extended for working parents
}

const WEEKS_PER_TERM = 38 // Term-time weeks per year
const WEEKS_PER_YEAR = 52

function calcMonthlyCost(
  weeklyHours: number,
  hourlyRate: number,
  fundedHours: number,
  allYear: boolean
): { gross: number; funded: number; net: number } {
  const chargeableHours = Math.max(0, weeklyHours - fundedHours)
  const weeklyGross = weeklyHours * hourlyRate
  const weeklyFunded = fundedHours * hourlyRate
  const weeklyNet = chargeableHours * hourlyRate

  const weeksPerYear = allYear ? WEEKS_PER_YEAR : WEEKS_PER_TERM
  const monthlyGross = (weeklyGross * weeksPerYear) / 12
  const monthlyFunded = (weeklyFunded * weeksPerYear) / 12
  const monthlyNet = (weeklyNet * weeksPerYear) / 12

  return {
    gross: Math.round(monthlyGross),
    funded: Math.round(monthlyFunded),
    net: Math.round(monthlyNet),
  }
}

export default function TrueCostCalculator({
  feeAvgMonthly,
  feeReportCount,
  placesFunded2yr,
  placesFunded3_4yr,
  nurseryName,
}: Props) {
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('3_4yr')
  const [sessions, setSessions] = useState<SessionsPerWeek>(5)
  const [hoursPerSession, setHoursPerSession] = useState(6)
  const [workingParent, setWorkingParent] = useState(true)
  const [allYear, setAllYear] = useState(true)

  // Estimate hourly rate from monthly average
  // Assume monthly avg is for 5 sessions/week, 10hrs/session, all year
  const estimatedHourlyRate = useMemo(() => {
    if (!feeAvgMonthly || feeReportCount < 1) return null
    // Common pattern: monthly fee / (average ~40hrs/week * 52 weeks / 12 months)
    return feeAvgMonthly / ((40 * 52) / 12)
  }, [feeAvgMonthly, feeReportCount])

  if (!estimatedHourlyRate) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">True Cost Calculator</h2>
        <p className="text-sm text-gray-600 mb-3">
          Estimate your real monthly cost after UK government funded hours are applied.
        </p>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-500 mb-1">
            No fee data available yet for {nurseryName}.
          </p>
          <p className="text-xs text-gray-400">
            Be the first parent to report fees — this helps other families estimate their costs.
          </p>
        </div>
        <div className="mt-3 bg-white/70 rounded-lg border border-blue-100 p-3">
          <p className="text-xs font-medium text-blue-800 mb-1">UK Funded Hours Entitlements</p>
          <ul className="text-xs text-blue-700 space-y-0.5">
            <li>Under 2 (working parents): <strong>15 free hours/week</strong></li>
            <li>2-year-olds: <strong>15 free hours/week</strong></li>
            <li>3-4-year-olds: <strong>15 hrs universal</strong>, <strong>30 hrs</strong> for working parents</li>
          </ul>
        </div>
      </div>
    )
  }

  const weeklyHours = sessions * hoursPerSession
  const entitlement = FUNDED_HOURS[ageGroup]
  const fundedHours = workingParent
    ? entitlement.extended
    : entitlement.universal

  // Check if nursery actually offers funded places for the selected age
  const hasFundedPlaces =
    (ageGroup === '2yr' && placesFunded2yr && placesFunded2yr > 0) ||
    (ageGroup === '3_4yr' && placesFunded3_4yr && placesFunded3_4yr > 0) ||
    ageGroup === 'under_2'

  const effectiveFundedHours = hasFundedPlaces ? fundedHours : 0

  const cost = calcMonthlyCost(weeklyHours, estimatedHourlyRate, effectiveFundedHours, allYear)
  const annualSaving = cost.funded * 12

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">True Cost Calculator</h2>
      <p className="text-xs text-gray-500 mb-4">
        Estimate your real monthly cost after UK government funded hours
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* Age group */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Child&apos;s age</label>
          <select
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="under_2">Under 2</option>
            <option value="2yr">2 years old</option>
            <option value="3_4yr">3-4 years old</option>
          </select>
        </div>

        {/* Sessions per week */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Days per week</label>
          <select
            value={sessions}
            onChange={(e) => setSessions(Number(e.target.value) as SessionsPerWeek)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="2">2 days</option>
            <option value="3">3 days</option>
            <option value="4">4 days</option>
            <option value="5">5 days</option>
          </select>
        </div>

        {/* Hours per session */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Hours per day</label>
          <select
            value={hoursPerSession}
            onChange={(e) => setHoursPerSession(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="4">4 hours (half day)</option>
            <option value="6">6 hours</option>
            <option value="8">8 hours</option>
            <option value="10">10 hours (full day)</option>
          </select>
        </div>

        {/* Term time / all year */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Attendance</label>
          <select
            value={allYear ? 'all_year' : 'term_time'}
            onChange={(e) => setAllYear(e.target.value === 'all_year')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all_year">All year (52 weeks)</option>
            <option value="term_time">Term time only (38 weeks)</option>
          </select>
        </div>
      </div>

      {/* Working parent toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
        <input
          type="checkbox"
          checked={workingParent}
          onChange={(e) => setWorkingParent(e.target.checked)}
          className="rounded border-gray-300 text-blue-600"
        />
        Working parent (eligible for extended hours)
      </label>

      {/* Results */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-3 gap-4 text-center mb-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Before funding</p>
            <p className="text-lg font-bold text-gray-400 line-through">
              &pound;{cost.gross.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Funding saves</p>
            <p className="text-lg font-bold text-green-600">
              {cost.funded > 0 ? `-\u00A3${cost.funded.toLocaleString()}` : '\u00A30'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">You pay</p>
            <p className="text-2xl font-extrabold text-gray-900">
              &pound;{cost.net.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">/month</p>
          </div>
        </div>

        {/* Funding info bar */}
        <div className={`text-xs rounded-lg p-2 ${effectiveFundedHours > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
          {effectiveFundedHours > 0 ? (
            <>
              <strong>{effectiveFundedHours} free hours/week</strong> applied ({weeklyHours}hrs used, {Math.max(0, weeklyHours - effectiveFundedHours)}hrs charged).
              {annualSaving > 0 && ` Saving ~\u00A3${annualSaving.toLocaleString()}/year.`}
            </>
          ) : ageGroup === 'under_2' && !workingParent ? (
            'No funded hours available for under-2s unless you are a working parent.'
          ) : !hasFundedPlaces ? (
            `This nursery doesn't appear to offer funded places for this age group.`
          ) : (
            'No funded hours applicable for your selection.'
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Estimate based on {feeReportCount} parent-reported fee{feeReportCount !== 1 ? 's' : ''} (~&pound;{estimatedHourlyRate.toFixed(2)}/hr).
        Actual costs may vary. Check with {nurseryName} directly for exact pricing.
      </p>
    </div>
  )
}
