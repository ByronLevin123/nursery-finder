import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isAvailable,
  getProfiles,
  createPost,
  __resetBufferCache,
} from '../src/services/bufferService.js'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Pull the parsed GraphQL request body out of a fetch mock call.
function bodyOf(call) {
  return JSON.parse(call[1].body)
}

beforeEach(() => {
  __resetBufferCache()
  process.env.BUFFER_API_TOKEN = 'test-token'
  delete process.env.BUFFER_ORGANIZATION_ID
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.BUFFER_API_TOKEN
  delete process.env.BUFFER_ORGANIZATION_ID
})

describe('isAvailable', () => {
  it('is true only when BUFFER_API_TOKEN is set', () => {
    expect(isAvailable()).toBe(true)
    delete process.env.BUFFER_API_TOKEN
    expect(isAvailable()).toBe(false)
  })
})

describe('getProfiles', () => {
  it('returns an error when not configured', async () => {
    delete process.env.BUFFER_API_TOKEN
    const { data, error } = await getProfiles()
    expect(data).toBeNull()
    expect(error).toMatch(/not configured/i)
  })

  it('resolves the organization then maps channels to the UI shape', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (_url, opts) => {
      const { query } = JSON.parse(opts.body)
      if (query.includes('GetOrganizations')) {
        return jsonResponse({ data: { account: { organizations: [{ id: 'org-9' }] } } })
      }
      return jsonResponse({
        data: {
          channels: [
            {
              id: 'ch-1',
              name: 'nm',
              displayName: 'NurseryMatch',
              service: 'twitter',
              avatar: 'a.png',
            },
          ],
        },
      })
    })

    const { data, error } = await getProfiles()
    expect(error).toBeNull()
    expect(data).toEqual([
      {
        id: 'ch-1',
        service: 'twitter',
        service_username: 'NurseryMatch',
        avatar_url: 'a.png',
        connected: true,
      },
    ])
    // The channels call must carry the resolved organization id.
    const channelsCall = fetchMock.mock.calls.find((c) => bodyOf(c).query.includes('GetChannels'))
    expect(channelsCall).toBeTruthy()
    expect(bodyOf(channelsCall).variables.organizationId).toBe('org-9')
  })

  it('skips the organization lookup when BUFFER_ORGANIZATION_ID is set', async () => {
    process.env.BUFFER_ORGANIZATION_ID = 'org-env'
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(jsonResponse({ data: { channels: [] } }))

    const { error } = await getProfiles()
    expect(error).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(bodyOf(fetchMock.mock.calls[0]).query).toContain('GetChannels')
  })

  it('surfaces GraphQL errors', async () => {
    process.env.BUFFER_ORGANIZATION_ID = 'org-env'
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ errors: [{ message: 'invalid token' }] })
    )
    const { data, error } = await getProfiles()
    expect(data).toBeNull()
    expect(error).toBe('invalid token')
  })
})

describe('createPost', () => {
  beforeEach(() => {
    process.env.BUFFER_ORGANIZATION_ID = 'org-env'
  })

  it('requires text and channelId', async () => {
    const { error } = await createPost({ text: '', channelId: 'ch-1' })
    expect(error).toMatch(/required/i)
  })

  it('queues a post (addToQueue) and returns the created post', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        jsonResponse({ data: { createPost: { post: { id: 'p1', dueAt: null } } } })
      )

    const { data, error } = await createPost({ text: 'Hello parents', channelId: 'ch-1' })
    expect(error).toBeNull()
    expect(data).toEqual({ id: 'p1', dueAt: null })

    const sent = bodyOf(fetchMock.mock.calls[0])
    expect(sent.query).toContain('addToQueue')
    expect(sent.query).toContain('"ch-1"')
    expect(sent.variables.text).toBe('Hello parents')
  })

  it('attaches an image via the imageUrl argument and variable', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(jsonResponse({ data: { createPost: { post: { id: 'p3' } } } }))

    await createPost({
      text: 'Look',
      channelId: 'ch-1',
      imageUrl: 'https://example.com/a.png',
    })
    const sent = bodyOf(fetchMock.mock.calls[0])
    expect(sent.query).toContain('$imageUrl: String!')
    expect(sent.query).toContain('imageUrl: $imageUrl')
    expect(sent.variables.imageUrl).toBe('https://example.com/a.png')
  })

  it('omits the imageUrl argument entirely when no image is given', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(jsonResponse({ data: { createPost: { post: { id: 'p4' } } } }))

    await createPost({ text: 'No image', channelId: 'ch-1' })
    const sent = bodyOf(fetchMock.mock.calls[0])
    expect(sent.query).not.toContain('imageUrl')
    expect(sent.variables.imageUrl).toBeUndefined()
  })

  it('custom-schedules when scheduledAt is provided', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(jsonResponse({ data: { createPost: { post: { id: 'p2' } } } }))

    await createPost({ text: 'Later', channelId: 'ch-1', scheduledAt: '2026-07-01T09:00:00.000Z' })
    const sent = bodyOf(fetchMock.mock.calls[0])
    expect(sent.query).toContain('customScheduled')
    expect(sent.query).toContain('2026-07-01T09:00:00.000Z')
  })

  it('returns the MutationError message when Buffer rejects the post', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ data: { createPost: { message: 'channel disconnected' } } })
    )
    const { data, error } = await createPost({ text: 'Hi', channelId: 'ch-1' })
    expect(data).toBeNull()
    expect(error).toBe('channel disconnected')
  })
})
