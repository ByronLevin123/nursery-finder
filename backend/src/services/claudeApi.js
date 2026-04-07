// Claude API wrapper — lazy init, graceful degradation when key missing.
// Single-turn completions only. Logs token usage but never the prompt body.

import { logger } from '../logger.js'

const DEFAULT_MODEL = 'claude-haiku-4-5'
const DEFAULT_TIMEOUT_MS = 30_000

let clientPromise = null

export class ClaudeUnavailableError extends Error {
  constructor(message = 'Claude API not configured') {
    super(message)
    this.name = 'ClaudeUnavailableError'
    this.code = 'CLAUDE_UNAVAILABLE'
  }
}

export function isClaudeAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

async function getClient() {
  if (!isClaudeAvailable()) {
    throw new ClaudeUnavailableError()
  }
  if (!clientPromise) {
    clientPromise = (async () => {
      const mod = await import('@anthropic-ai/sdk')
      const Anthropic = mod.default || mod.Anthropic
      return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    })()
  }
  return clientPromise
}

// For tests
export function __resetClaudeClient() {
  clientPromise = null
}

export async function callClaude({ prompt, system, maxTokens = 500, model = DEFAULT_MODEL }) {
  if (!isClaudeAvailable()) {
    throw new ClaudeUnavailableError()
  }
  if (typeof prompt !== 'string' || !prompt.length) {
    throw new Error('callClaude: prompt is required')
  }

  const client = await getClient()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    logger.info(
      { model, promptChars: prompt.length, systemChars: system?.length || 0 },
      'claude request'
    )

    const response = await client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system: system || undefined,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: controller.signal }
    )

    const text =
      response?.content
        ?.filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n') || ''

    logger.info(
      {
        model,
        inputTokens: response?.usage?.input_tokens,
        outputTokens: response?.usage?.output_tokens,
      },
      'claude response'
    )

    return text
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn({ model }, 'claude request timed out')
      throw new Error('Claude request timed out')
    }
    logger.warn({ err: err.message }, 'claude request failed')
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
