'use client'

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { nurseryAdvisorChat, NurseryAdvisorContext } from '@/lib/api'
import { trackEvent } from '@/lib/analytics'

interface Message {
  id: string
  role: 'user' | 'advisor'
  text: string
  suggestions?: string[]
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'advisor',
  text: "Hi! I can help you find the right nursery. Ask me anything about childcare, Ofsted ratings, funded hours, or what to look for.",
  suggestions: ['What are funded hours?', 'Take the nursery quiz', 'How do Ofsted ratings work?'],
}

const STORAGE_KEY = 'nurseryAdvisorMessages'
const SHOW_DELAY_MS = 10_000

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadMessages(): Message[] {
  if (typeof window === 'undefined') return [WELCOME_MESSAGE]
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return [WELCOME_MESSAGE]
}

function saveMessages(messages: Message[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch { /* ignore */ }
}

export default function NurseryAdvisor() {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => loadMessages())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Show the button after a delay
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  // Persist messages to sessionStorage
  useEffect(() => {
    saveMessages(messages)
  }, [messages])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const handleSuggestionClick = useCallback((suggestion: string) => {
    // Navigation suggestions
    if (/^search nurseries near/i.test(suggestion)) {
      const match = suggestion.match(/near\s+(.+)/i)
      if (match && match[1] && match[1].toLowerCase() !== 'you') {
        router.push(`/search?postcode=${encodeURIComponent(match[1].trim())}`)
      } else {
        router.push('/search')
      }
      setOpen(false)
      return
    }
    if (/take the.*quiz/i.test(suggestion)) {
      router.push('/quiz')
      setOpen(false)
      return
    }
    if (/compare/i.test(suggestion)) {
      router.push('/compare')
      setOpen(false)
      return
    }
    if (/read.*reviews/i.test(suggestion)) {
      router.push('/search')
      setOpen(false)
      return
    }
    // Otherwise treat it as a new message to the advisor
    setInput(suggestion)
  }, [router])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: Message = { id: generateId(), role: 'user', text: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    trackEvent('AI Assistant Query')

    // Build context from the conversation so far
    const context: NurseryAdvisorContext = {}
    // We keep context lightweight — just pass the raw message
    const result = await nurseryAdvisorChat(text.trim(), context)

    const advisorMsg: Message = {
      id: generateId(),
      role: 'advisor',
      text: result.response,
      suggestions: result.suggestions,
    }
    setMessages((prev) => [...prev, advisorMsg])
    setLoading(false)
  }, [loading])

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }, [input, sendMessage])

  if (!visible) return null

  // Floating button (collapsed state)
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:bottom-6"
        aria-label="Open nursery advisor"
        title="Need help finding a nursery?"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
    )
  }

  // Expanded chat panel
  return (
    <div className="fixed bottom-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:bottom-6 sm:right-4 sm:w-[400px] sm:rounded-2xl sm:border sm:border-gray-200" style={{ maxHeight: '500px' }}>
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-none border-b border-gray-200 bg-indigo-600 px-4 py-3 sm:rounded-t-2xl">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="text-sm font-semibold text-white">Nursery Advisor</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-full p-1 text-indigo-200 transition-colors hover:bg-indigo-700 hover:text-white focus:outline-none"
          aria-label="Close advisor"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3" style={{ minHeight: '200px', maxHeight: '360px' }}>
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="flex max-w-[85%] flex-col gap-1.5">
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.text}
                </div>
                {/* Suggestion chips */}
                {msg.role === 'advisor' && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {msg.suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-gray-100 px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-gray-200 px-3 py-2.5">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about nurseries, funding, Ofsted..."
          maxLength={1000}
          disabled={loading}
          className="flex-1 rounded-full border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600"
          aria-label="Send message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>
    </div>
  )
}
