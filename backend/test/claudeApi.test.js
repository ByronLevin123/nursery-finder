import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createMock = vi.fn(async () => ({
  content: [{ type: 'text', text: 'hello world' }],
  usage: { input_tokens: 10, output_tokens: 5 },
}))

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    constructor() {
      this.messages = { create: createMock }
    }
  }
  return { default: Anthropic, Anthropic }
})

let isClaudeAvailable
let callClaude
let __resetClaudeClient
let ClaudeUnavailableError

beforeEach(async () => {
  vi.resetModules()
  createMock.mockClear()
  const mod = await import('../src/services/claudeApi.js')
  isClaudeAvailable = mod.isClaudeAvailable
  callClaude = mod.callClaude
  __resetClaudeClient = mod.__resetClaudeClient
  ClaudeUnavailableError = mod.ClaudeUnavailableError
  __resetClaudeClient()
})

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
})

describe('claudeApi', () => {
  it('isClaudeAvailable returns false when env not set', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(isClaudeAvailable()).toBe(false)
  })

  it('isClaudeAvailable returns true when env set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    expect(isClaudeAvailable()).toBe(true)
  })

  it('callClaude throws ClaudeUnavailableError when key missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    await expect(callClaude({ prompt: 'hi' })).rejects.toBeInstanceOf(ClaudeUnavailableError)
  })

  it('callClaude calls the SDK with correct shape and returns text', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    const result = await callClaude({
      prompt: 'hello',
      system: 'be brief',
      maxTokens: 50,
    })
    expect(result).toBe('hello world')
    expect(createMock).toHaveBeenCalledTimes(1)
    const [args] = createMock.mock.calls[0]
    expect(args.model).toBe('claude-haiku-4-5')
    expect(args.max_tokens).toBe(50)
    expect(args.system).toBe('be brief')
    expect(args.messages).toEqual([{ role: 'user', content: 'hello' }])
  })
})
