'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getNurseryQuestions,
  postNurseryQuestion,
  postNurseryAnswer,
  NurseryQuestion,
} from '@/lib/api'

interface Props {
  urn: string
  isProvider?: boolean
}

export default function NurseryQA({ urn, isProvider = false }: Props) {
  const [questions, setQuestions] = useState<NurseryQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [showAskForm, setShowAskForm] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [submittingQuestion, setSubmittingQuestion] = useState(false)
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [newAnswer, setNewAnswer] = useState('')
  const [submittingAnswer, setSubmittingAnswer] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  // Check auth state
  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setUserId(data.session.user.id)
        setToken(data.session.access_token)
      }
    }
    checkAuth()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
      setToken(session?.access_token ?? null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // Fetch questions
  async function fetchQuestions() {
    try {
      setLoading(true)
      const data = await getNurseryQuestions(urn)
      setQuestions(data.questions)
      setError(null)
    } catch {
      setError('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urn])

  // Submit a question
  async function handleAskQuestion(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    try {
      setSubmittingQuestion(true)
      await postNurseryQuestion(urn, newQuestion, token)
      setNewQuestion('')
      setShowAskForm(false)
      await fetchQuestions()
    } catch (err: any) {
      setError(err.message || 'Failed to post question')
    } finally {
      setSubmittingQuestion(false)
    }
  }

  // Submit an answer
  async function handlePostAnswer(questionId: string, e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    try {
      setSubmittingAnswer(true)
      await postNurseryAnswer(urn, questionId, newAnswer, token)
      setNewAnswer('')
      setAnsweringId(null)
      await fetchQuestions()
    } catch (err: any) {
      setError(err.message || 'Failed to post answer')
    } finally {
      setSubmittingAnswer(false)
    }
  }

  const visible = showAll ? questions : questions.slice(0, 3)
  const hasMore = questions.length > 3

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Parent Q&amp;A</h2>
        {userId ? (
          <button
            onClick={() => setShowAskForm(!showAskForm)}
            className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            Ask a question
          </button>
        ) : (
          <p className="text-sm text-gray-500">Sign in to ask a question</p>
        )}
      </div>

      {/* Ask form */}
      {showAskForm && (
        <form onSubmit={handleAskQuestion} className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <label htmlFor="qa-question" className="block text-sm font-medium text-gray-700 mb-1">
            Your question
          </label>
          <textarea
            id="qa-question"
            rows={3}
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g. What are the pick-up and drop-off times?"
            minLength={10}
            maxLength={500}
            required
          />
          <p className="text-xs text-gray-400 mt-1">{newQuestion.length}/500 characters</p>
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={submittingQuestion || newQuestion.trim().length < 10}
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {submittingQuestion ? 'Posting...' : 'Post question'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAskForm(false); setNewQuestion('') }}
              className="text-sm text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading && <p className="text-sm text-gray-500">Loading questions...</p>}

      {!loading && questions.length === 0 && (
        <p className="text-sm text-gray-500">No questions yet. Be the first to ask!</p>
      )}

      {/* Questions list */}
      <div className="space-y-4">
        {visible.map((q) => (
          <div key={q.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900">{q.question}</p>
            <p className="text-xs text-gray-400 mt-1">
              Asked {new Date(q.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>

            {/* Answers */}
            {q.answers.length > 0 && (
              <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-100">
                {q.answers.map((a) => (
                  <div key={a.id} className="text-sm">
                    <div className="flex items-center gap-2 mb-0.5">
                      {a.is_provider && (
                        <span className="inline-block text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                          Provider
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-gray-700">{a.answer}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Answer button / form — only visible to provider */}
            {userId && isProvider && answeringId !== q.id && (
              <button
                onClick={() => { setAnsweringId(q.id); setNewAnswer('') }}
                className="mt-2 text-xs text-indigo-600 hover:underline"
              >
                Answer
              </button>
            )}

            {answeringId === q.id && (
              <form onSubmit={(e) => handlePostAnswer(q.id, e)} className="mt-3">
                <textarea
                  rows={2}
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Write your answer..."
                  minLength={10}
                  maxLength={1000}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">{newAnswer.length}/1000 characters</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={submittingAnswer || newAnswer.trim().length < 10}
                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                  >
                    {submittingAnswer ? 'Posting...' : 'Post answer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAnsweringId(null); setNewAnswer('') }}
                    className="text-xs text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>

      {/* Show all toggle */}
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 text-sm text-indigo-600 hover:underline"
        >
          Show all {questions.length} questions
        </button>
      )}
      {hasMore && showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-4 text-sm text-indigo-600 hover:underline"
        >
          Show fewer questions
        </button>
      )}
    </section>
  )
}
