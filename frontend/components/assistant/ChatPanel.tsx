'use client'

import { useState, useRef, useEffect } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

interface Props {
  messages: ChatMessage[]
  loading?: boolean
  onSend: (text: string) => void
}

export default function ChatPanel({ messages, loading, onSend }: Props) {
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  function submit() {
    const t = text.trim()
    if (!t || loading) return
    onSend(t)
    setText('')
  }

  return (
    <div className="flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm h-full min-h-[480px]">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Chat with the Assistant</h2>
        <p className="text-xs text-gray-500">Tell me what your family needs</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-gray-400 italic">
            Try: "We're moving to South London with a 2-year-old, budget £600k, need outstanding nurseries and low crime."
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 rounded-lg px-3 py-2 text-sm">
              <span className="inline-block animate-pulse">Thinking…</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 p-3">
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={2}
            placeholder="Ask anything…"
            className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          />
          <button
            onClick={submit}
            disabled={loading || !text.trim()}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:bg-gray-300"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
