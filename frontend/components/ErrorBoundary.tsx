'use client'

import React from 'react'

/**
 * Generic React ErrorBoundary.
 *
 * Catches render errors in any descendant component tree and shows a
 * friendly fallback instead of a blank white page. Sends the error to
 * Sentry if NEXT_PUBLIC_SENTRY_DSN is configured (the @sentry/nextjs
 * SDK exposes a window.Sentry once initialised).
 *
 * Use sparingly at strategic points (root layout, large client widgets).
 * Don't blanket every component — granular boundaries hide real bugs.
 */

interface Props {
  children: React.ReactNode
  /** Override the default fallback UI. */
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

declare global {
  interface Window {
    Sentry?: {
      captureException?: (err: unknown, ctx?: unknown) => void
    }
  }
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Best-effort send to Sentry. The @sentry/nextjs SDK installs a global
    // when NEXT_PUBLIC_SENTRY_DSN is set; if not, we just log to console.
    if (typeof window !== 'undefined' && window.Sentry?.captureException) {
      try {
        window.Sentry.captureException(error, { contexts: { react: errorInfo } })
      } catch {
        // ignore — fallback UI still shows
      }
    } else {
      // eslint-disable-next-line no-console
      console.error('ErrorBoundary caught:', error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4" aria-hidden>
            🤔
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-6">
            We&apos;ve logged the error and will look into it. Try reloading the page,
            or head back to the homepage.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={this.handleReset}
              className="px-5 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700"
            >
              Try again
            </button>
            <a
              href="/"
              className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-md font-semibold hover:bg-gray-50"
            >
              Home
            </a>
          </div>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre className="text-left text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mt-6 overflow-auto">
              {this.state.error.message}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
