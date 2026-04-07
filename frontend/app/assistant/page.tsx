'use client'

import { useState, useCallback } from 'react'
import {
  assistantChat,
  assistantSearch,
  EMPTY_ASSISTANT_CRITERIA,
  type AssistantCriteria,
  type AssistantArea,
} from '@/lib/api'
import ChatPanel, { type ChatMessage } from '@/components/assistant/ChatPanel'
import CriteriaChips from '@/components/assistant/CriteriaChips'
import DistrictMatchMap from '@/components/assistant/DistrictMatchMap'
import AssistantResultCard from '@/components/assistant/AssistantResultCard'
import SaveSearchButton from '@/components/SaveSearchButton'

type MobileTab = 'chat' | 'criteria' | 'map' | 'results'

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [criteria, setCriteria] = useState<AssistantCriteria>(EMPTY_ASSISTANT_CRITERIA)
  const [results, setResults] = useState<AssistantArea[]>([])
  const [loadingChat, setLoadingChat] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat')

  const runSearch = useCallback(async (c: AssistantCriteria) => {
    setLoadingSearch(true)
    setError(null)
    try {
      const out = await assistantSearch(c)
      if (!out) {
        setError('Search failed — please try again.')
        return
      }
      setResults(out.data || [])
    } finally {
      setLoadingSearch(false)
    }
  }, [])

  const onSend = useCallback(
    async (text: string) => {
      setMessages((m) => [...m, { role: 'user', text }])
      setLoadingChat(true)
      setError(null)
      try {
        const out = await assistantChat(text, criteria)
        if (!out) {
          setError('Chat unavailable. Is the AI backend configured?')
          setMessages((m) => [
            ...m,
            { role: 'assistant', text: "Sorry — I couldn't reach the AI service." },
          ])
          return
        }
        setCriteria(out.criteria)
        setMessages((m) => [...m, { role: 'assistant', text: out.assistant_message }])
        await runSearch(out.criteria)
      } finally {
        setLoadingChat(false)
      }
    },
    [criteria, runSearch]
  )

  const onCriteriaChange = useCallback(
    (next: AssistantCriteria) => {
      setCriteria(next)
      runSearch(next)
    },
    [runSearch]
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            🤖 AI Family Move Assistant
          </h1>
          <p className="text-gray-600">
            Tell me what your family needs — I'll rank UK districts by nursery quality, crime,
            deprivation, and affordability. Chat, edit your criteria, see matches on the map.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Desktop: 3-column grid */}
        <div className="hidden lg:grid grid-cols-12 gap-4 mb-8">
          <div className="col-span-4">
            <ChatPanel messages={messages} loading={loadingChat} onSend={onSend} />
          </div>
          <div className="col-span-5">
            <DistrictMatchMap results={results} />
          </div>
          <div className="col-span-3">
            <CriteriaChips criteria={criteria} onChange={onCriteriaChange} />
          </div>
        </div>

        {/* Mobile: tab-switched single column with sticky bottom bar */}
        <div className="lg:hidden mb-24">
          {mobileTab === 'chat' && (
            <ChatPanel messages={messages} loading={loadingChat} onSend={onSend} />
          )}
          {mobileTab === 'criteria' && (
            <CriteriaChips criteria={criteria} onChange={onCriteriaChange} />
          )}
          {mobileTab === 'map' && <DistrictMatchMap results={results} />}
          {mobileTab === 'results' && (
            <div className="grid grid-cols-1 gap-4">
              {results.map((r) => (
                <AssistantResultCard key={r.postcode_district} area={r} />
              ))}
              {results.length === 0 && (
                <p className="text-sm text-gray-500 italic">No matches yet.</p>
              )}
            </div>
          )}
        </div>

        <section className="hidden lg:block">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">
              Ranked matches {results.length > 0 && <span className="text-gray-400 font-normal text-base">({results.length})</span>}
            </h2>
            <div className="flex items-center gap-2">
              <SaveSearchButton
                criteria={{ type: 'assistant', criteria }}
                defaultName="AI assistant search"
              />
              <button
                onClick={() => runSearch(criteria)}
                disabled={loadingSearch}
                className="text-sm px-3 py-1.5 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:bg-gray-300"
              >
                {loadingSearch ? 'Searching…' : 'Re-run search'}
              </button>
            </div>
          </div>
          {results.length === 0 && !loadingSearch && (
            <p className="text-sm text-gray-500 italic">
              Start a conversation to see matches, or set some priorities on the right.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((r) => (
              <AssistantResultCard key={r.postcode_district} area={r} />
            ))}
          </div>
        </section>
      </div>

      {/* Mobile sticky bottom tab bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40">
        <div className="grid grid-cols-4 text-xs">
          {(['chat', 'criteria', 'map', 'results'] as MobileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`py-2 font-medium ${
                mobileTab === tab ? 'text-indigo-600 border-t-2 border-indigo-600' : 'text-gray-500'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
