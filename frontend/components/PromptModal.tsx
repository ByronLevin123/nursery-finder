'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  open: boolean
  title: string
  message?: string
  placeholder?: string
  defaultValue?: string
  submitLabel?: string
  cancelLabel?: string
  validate?: (value: string) => string | null // return error string or null
  onSubmit: (value: string) => void
  onCancel: () => void
}

export default function PromptModal({
  open,
  title,
  message,
  placeholder = '',
  defaultValue = '',
  submitLabel = 'OK',
  cancelLabel = 'Cancel',
  validate,
  onSubmit,
  onCancel,
}: Props) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(defaultValue)
      setError('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, defaultValue])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (validate) {
      const err = validate(trimmed)
      if (err) {
        setError(err)
        return
      }
    }
    if (!trimmed) {
      setError('Please enter a value')
      return
    }
    onSubmit(trimmed)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {message && <p className="mt-1 text-sm text-gray-600">{message}</p>}
        <form onSubmit={handleSubmit} className="mt-3">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError('') }}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
