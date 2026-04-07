'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_PREFERENCES, Preferences, savePreferences, loadPreferences } from '@/lib/preferences'

interface Props {
  open: boolean
  onClose: () => void
}

export default function PriorityWizard({ open, onClose }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [prefs, setPrefs] = useState<Preferences>(() =>
    typeof window !== 'undefined' ? loadPreferences() : DEFAULT_PREFERENCES
  )

  if (!open) return null

  function patch(p: Partial<Preferences>) {
    setPrefs(prev => ({ ...prev, ...p }))
  }
  function patchWeights(w: Partial<Preferences['weights']>) {
    setPrefs(prev => ({ ...prev, weights: { ...prev.weights, ...w } }))
  }

  function finish() {
    savePreferences(prefs)
    onClose()
    router.push('/search?postcode=')
  }

  const fundedChoice =
    prefs.needsFunded2yr && prefs.needsFunded3_4yr ? 'both'
      : prefs.needsFunded2yr ? '2yr'
      : prefs.needsFunded3_4yr ? '3-4yr'
      : 'neither'

  function setFunded(choice: string) {
    patch({
      needsFunded2yr: choice === '2yr' || choice === 'both',
      needsFunded3_4yr: choice === '3-4yr' || choice === 'both',
    })
  }

  return (
    <div className="fixed inset-0 z-[2100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">Tell us what matters</h2>
            <button onClick={onClose} aria-label="Close" className="text-white/80 hover:text-white text-xl">✕</button>
          </div>
          <div className="flex gap-1 mt-3">
            {[1, 2, 3].map(n => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </div>

        <div className="p-5">
          {step === 1 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Which Ofsted grade do you need?</h3>
              <p className="text-xs text-gray-500 mb-4">We'll exclude anything below this.</p>
              <div className="space-y-2">
                {[
                  { v: 'any', l: 'Any grade', d: 'Show all nurseries' },
                  { v: 'Good', l: 'Good or better', d: 'Most parents pick this' },
                  { v: 'Outstanding', l: 'Outstanding only', d: 'Highest tier' },
                ].map(o => (
                  <button
                    key={o.v}
                    onClick={() => patch({ minGrade: o.v as any })}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition ${
                      prefs.minGrade === o.v
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900 text-sm">{o.l}</div>
                    <div className="text-xs text-gray-500">{o.d}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Funded places?</h3>
              <p className="text-xs text-gray-500 mb-4">Government-funded hours for your child's age.</p>
              <div className="space-y-2">
                {[
                  { v: 'neither', l: 'No, paying privately' },
                  { v: '2yr', l: '2-year-old funded place' },
                  { v: '3-4yr', l: '3 to 4-year-old funded place' },
                  { v: 'both', l: 'Both 2yr and 3-4yr' },
                ].map(o => (
                  <button
                    key={o.v}
                    onClick={() => setFunded(o.v)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition ${
                      fundedChoice === o.v
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900 text-sm">{o.l}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">What matters most?</h3>
              <p className="text-xs text-gray-500 mb-4">Drag each slider — 5 = critical, 1 = doesn't matter.</p>
              <div className="space-y-3">
                {(['quality', 'places', 'budget', 'location', 'reviews'] as const).map(k => (
                  <div key={k}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-700 font-medium">{k}</span>
                      <span className="text-indigo-700 font-bold">{prefs.weights[k]}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={prefs.weights[k]}
                      onChange={e => patchWeights({ [k]: Number(e.target.value) } as any)}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex justify-between gap-2">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={finish}
              className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
            >
              Save & search
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
