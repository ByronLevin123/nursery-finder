import { describe, it, expect } from 'vitest'
import { scrubUrlSecrets } from '../src/utils.js'

describe('scrubUrlSecrets', () => {
  it('redacts api_key values in query strings', () => {
    expect(scrubUrlSecrets('/api/v1/nurseries/search?api_key=sk_live_abc123&q=leeds')).toBe(
      '/api/v1/nurseries/search?api_key=[Redacted]&q=leeds'
    )
  })

  it('redacts token-style params anywhere in the query', () => {
    expect(scrubUrlSecrets('/x?q=1&access_token=abc&token=def')).toBe(
      '/x?q=1&access_token=[Redacted]&token=[Redacted]'
    )
  })

  it('is case-insensitive', () => {
    expect(scrubUrlSecrets('/x?API_KEY=abc')).toBe('/x?API_KEY=[Redacted]')
  })

  it('leaves URLs without secrets untouched', () => {
    expect(scrubUrlSecrets('/api/v1/nurseries/search?q=leeds&page=2')).toBe(
      '/api/v1/nurseries/search?q=leeds&page=2'
    )
  })

  it('passes through non-strings', () => {
    expect(scrubUrlSecrets(undefined)).toBe(undefined)
  })
})
