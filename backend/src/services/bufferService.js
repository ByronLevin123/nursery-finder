// Buffer social media service — modern GraphQL API (https://api.buffer.com).
//
// Buffer retired its classic v1 REST API (api.bufferapp.com/1) to new developers.
// A "standard" Buffer account today issues a personal API key for the GraphQL API,
// sent as a Bearer token. Docs: https://developers.buffer.com
//
// Lazy — every function no-ops with a clear error when BUFFER_API_TOKEN is unset.
// All functions return the { data, error } pattern used across our services.

import { logger } from '../logger.js'

const BUFFER_GRAPHQL_URL = 'https://api.buffer.com'

// Resolved organization id is cached for the process lifetime.
let _organizationId = null

/**
 * Returns true if Buffer integration is configured.
 */
export function isAvailable() {
  return Boolean(process.env.BUFFER_API_TOKEN)
}

// For tests — clears the cached organization id.
export function __resetBufferCache() {
  _organizationId = null
}

/**
 * Execute a GraphQL operation against the Buffer API.
 * Returns { data, error } where error is a string on failure.
 */
async function graphql(query, variables = {}) {
  try {
    const res = await fetch(BUFFER_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.BUFFER_API_TOKEN}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const body = await res.text()
      logger.warn({ status: res.status, body }, 'buffer graphql http error')
      return { data: null, error: `Buffer API error: ${res.status}` }
    }

    const json = await res.json()
    if (json.errors?.length) {
      const message = json.errors.map((e) => e.message).join('; ')
      logger.warn({ errors: json.errors }, 'buffer graphql returned errors')
      return { data: null, error: message }
    }

    return { data: json.data, error: null }
  } catch (err) {
    logger.error({ err: err.message }, 'buffer graphql exception')
    return { data: null, error: err.message }
  }
}

/**
 * Resolve the organization id to operate against. Prefers BUFFER_ORGANIZATION_ID;
 * otherwise queries the account and uses the first organization. Cached.
 */
async function getOrganizationId() {
  if (process.env.BUFFER_ORGANIZATION_ID) {
    return { id: process.env.BUFFER_ORGANIZATION_ID, error: null }
  }
  if (_organizationId) {
    return { id: _organizationId, error: null }
  }

  const { data, error } = await graphql(`
    query GetOrganizations {
      account {
        organizations {
          id
        }
      }
    }
  `)
  if (error) return { id: null, error }

  const orgId = data?.account?.organizations?.[0]?.id
  if (!orgId) {
    return { id: null, error: 'No Buffer organization found for this account' }
  }
  _organizationId = orgId
  return { id: orgId, error: null }
}

/**
 * List all connected social channels (profiles) for the account's organization.
 * Returns channels shaped for the admin UI: { id, service, service_username,
 * avatar_url, connected }.
 */
export async function getProfiles() {
  if (!isAvailable()) {
    return { data: null, error: 'Buffer is not configured (BUFFER_API_TOKEN missing)' }
  }

  const { id: organizationId, error: orgError } = await getOrganizationId()
  if (orgError) return { data: null, error: orgError }

  const { data, error } = await graphql(
    `
      query GetChannels($organizationId: String!) {
        channels(input: { organizationId: $organizationId }) {
          id
          name
          displayName
          service
          avatar
        }
      }
    `,
    { organizationId }
  )
  if (error) return { data: null, error }

  const channels = (data?.channels || []).map((c) => ({
    id: c.id,
    service: c.service,
    service_username: c.displayName || c.name,
    avatar_url: c.avatar || null,
    connected: true,
  }))

  logger.info({ count: channels.length }, 'buffer channels fetched')
  return { data: channels, error: null }
}

/**
 * Create a post on a single channel. Queues it (addToQueue) unless scheduledAt
 * is provided, in which case it is custom-scheduled for that time.
 *
 * @param {object} opts
 * @param {string} opts.text       - Post content
 * @param {string} opts.channelId  - Buffer channel id
 * @param {string} [opts.scheduledAt] - ISO 8601 timestamp (UTC) for scheduling
 * @param {string} [opts.imageUrl]  - Public image URL to attach. Required by
 *   image-only networks like Instagram; optional elsewhere. Buffer fetches the
 *   image from this URL, so it must be publicly reachable.
 */
export async function createPost({ text, channelId, scheduledAt, imageUrl }) {
  if (!isAvailable()) {
    return { data: null, error: 'Buffer is not configured (BUFFER_API_TOKEN missing)' }
  }
  if (!text || !channelId) {
    return { data: null, error: 'text and channelId are required' }
  }
  // channelId/scheduledAt are interpolated into the GraphQL document below, so
  // they must be plain strings (a non-string would stringify to GraphQL syntax)
  // and scheduledAt must look like an ISO-8601 timestamp.
  if (typeof channelId !== 'string') {
    return { data: null, error: 'channelId must be a string' }
  }
  if (scheduledAt !== undefined && scheduledAt !== null) {
    if (typeof scheduledAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(scheduledAt)) {
      return { data: null, error: 'scheduledAt must be an ISO-8601 timestamp string' }
    }
  }

  // JSON.stringify yields a safe GraphQL string literal for the validated
  // strings above. User-supplied text and imageUrl are passed as variables so
  // they can never alter the query.
  const channelLiteral = JSON.stringify(channelId)
  const scheduling = scheduledAt
    ? `mode: customScheduled, dueAt: ${JSON.stringify(scheduledAt)}`
    : 'mode: addToQueue'

  // Optional image — adds an `imageUrl` argument to the input (and its variable
  // declaration) only when supplied, matching Buffer's "Create Image Post" form.
  const varDecls = ['$text: String!']
  const inputExtra = []
  const variables = { text }
  if (imageUrl) {
    varDecls.push('$imageUrl: String!')
    inputExtra.push('imageUrl: $imageUrl')
    variables.imageUrl = imageUrl
  }
  const extra = inputExtra.length ? `, ${inputExtra.join(', ')}` : ''

  const { data, error } = await graphql(
    `
      mutation CreatePost(${varDecls.join(', ')}) {
        createPost(
          input: { text: $text, channelId: ${channelLiteral}, schedulingType: automatic, ${scheduling}${extra} }
        ) {
          ... on PostActionSuccess {
            post {
              id
              dueAt
            }
          }
          ... on MutationError {
            message
          }
        }
      }
    `,
    variables
  )
  if (error) return { data: null, error }

  const result = data?.createPost
  if (result?.message) {
    logger.warn({ message: result.message, channelId }, 'buffer createPost rejected')
    return { data: null, error: result.message }
  }

  const post = result?.post || null
  logger.info({ postId: post?.id, channelId, hasImage: !!imageUrl }, 'buffer post created')
  return { data: post, error: null }
}

export default { isAvailable, getProfiles, createPost, __resetBufferCache }
