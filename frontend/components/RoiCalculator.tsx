'use client'

import { useState } from 'react'

export default function RoiCalculator() {
  const [monthlyFee, setMonthlyFee] = useState(1200)
  const [availableSpaces, setAvailableSpaces] = useState(5)
  const [fillWithout, setFillWithout] = useState(70)
  const [fillWith, setFillWith] = useState(90)

  const additionalChildren = Math.round(availableSpaces * ((fillWith - fillWithout) / 100) * 10) / 10
  const additionalMonthly = Math.round(additionalChildren * monthlyFee)
  const additionalAnnual = additionalMonthly * 12
  const proPlanCost = 29 * 12
  const roiMultiple = proPlanCost > 0 ? Math.round((additionalAnnual / proPlanCost) * 10) / 10 : 0

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 md:p-8">
      <h3 className="text-xl font-bold text-gray-900 mb-6">ROI Calculator</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly fee per child: <span className="font-bold text-gray-900">&pound;{monthlyFee.toLocaleString()}</span>
            </label>
            <input
              type="range"
              min={400}
              max={3000}
              step={50}
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>&pound;400</span>
              <span>&pound;3,000</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Available spaces: <span className="font-bold text-gray-900">{availableSpaces}</span>
            </label>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={availableSpaces}
              onChange={(e) => setAvailableSpaces(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1</span>
              <span>30</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fill rate without NurseryMatch: <span className="font-bold text-gray-900">{fillWithout}%</span>
            </label>
            <input
              type="range"
              min={30}
              max={95}
              step={5}
              value={fillWithout}
              onChange={(e) => {
                const val = Number(e.target.value)
                setFillWithout(val)
                if (val >= fillWith) setFillWith(Math.min(100, val + 5))
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>30%</span>
              <span>95%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fill rate with NurseryMatch: <span className="font-bold text-emerald-600">{fillWith}%</span>
            </label>
            <input
              type="range"
              min={Math.max(fillWithout + 5, 35)}
              max={100}
              step={5}
              value={fillWith}
              onChange={(e) => setFillWith(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{Math.max(fillWithout + 5, 35)}%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Outputs */}
        <div className="bg-gray-50 rounded-xl p-6 space-y-5">
          <div>
            <p className="text-sm text-gray-500">Additional children per month</p>
            <p className="text-3xl font-bold text-emerald-600">+{additionalChildren}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Additional monthly revenue</p>
            <p className="text-3xl font-bold text-emerald-600">
              +&pound;{additionalMonthly.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Additional annual revenue</p>
            <p className="text-3xl font-bold text-emerald-600">
              +&pound;{additionalAnnual.toLocaleString()}
            </p>
          </div>
          <div className="pt-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">ROI vs Pro plan (&pound;29/mo)</p>
            <p className="text-3xl font-bold text-blue-600">{roiMultiple}x return</p>
          </div>
          <p className="text-xs text-gray-400 pt-2">
            This is an estimate based on the inputs above. Actual results will vary depending on your location, competition, and profile quality.
          </p>
        </div>
      </div>
    </div>
  )
}
