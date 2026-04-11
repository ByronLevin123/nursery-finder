'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from '@/components/SessionProvider'
import { API_URL } from '@/lib/api'

interface Message {
  id: string
  enquiry_id: string
  sender_id: string
  sender_role: 'parent' | 'provider'
  body: string
  read_at: string | null
  created_at: string
}

interface MessageThreadProps {
  enquiryId: string
  currentUserRole: 'parent' | 'provider'
}

export default function MessageThread({ enquiryId, currentUserRole }: MessageThreadProps) {
  const { session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const token = session?.access_token

  const fetchMessages = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/v1/enquiries/${enquiryId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.data || [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [token, enquiryId])

  // Initial load
  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Poll every 10 seconds when component is visible
  useEffect(() => {
    if (!token) return
    const interval = setInterval(fetchMessages, 10_000)
    return () => clearInterval(interval)
  }, [token, fetchMessages])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Mark messages as read when viewed
  useEffect(() => {
    if (!token || messages.length === 0) return
    const hasUnread = messages.some(
      (m) => m.sender_role !== currentUserRole && !m.read_at
    )
    if (hasUnread) {
      fetch(`${API_URL}/api/v1/enquiries/${enquiryId}/messages/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      }).catch((err) => { console.error('Failed to mark messages read:', err) })
    }
  }, [token, enquiryId, messages, currentUserRole])

  async function handleSend() {
    if (!token || !newMessage.trim() || sending) return
    setSending(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/api/v1/enquiries/${enquiryId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: newMessage.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to send message')
        return
      }

      const sent = await res.json()
      setMessages((prev) => [...prev, sent])
      setNewMessage('')
      inputRef.current?.focus()
    } catch {
      setError('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)

    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 0) return time
    if (diffDays === 1) return `Yesterday ${time}`
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + time
  }

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-gray-400">Loading messages...</div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      {/* Message list */}
      <div
        ref={scrollRef}
        className="max-h-64 overflow-y-auto p-3 space-y-2"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-4">
            No messages yet. Start the conversation below.
          </p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_role === currentUserRole
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    isMe
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      isMe ? 'text-indigo-200' : 'text-gray-400'
                    }`}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 bg-white">
        {error && (
          <p className="text-xs text-red-500 mb-2">{error}</p>
        )}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            maxLength={5000}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
