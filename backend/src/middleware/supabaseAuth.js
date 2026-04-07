// Supabase JWT auth middleware
// optionalAuth attaches req.user if a valid bearer token is present, never blocks.
// requireAuth blocks with 401 if no valid user is attached.

import { createClient } from '@supabase/supabase-js'
import { logger } from '../logger.js'

let authClient = null

if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function extractToken(req) {
  const header = req.headers['authorization'] || req.headers['Authorization']
  if (!header || typeof header !== 'string') return null
  const parts = header.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null
  return parts[1]
}

export async function optionalAuth(req, _res, next) {
  try {
    const token = extractToken(req)
    if (!token || !authClient) return next()
    const { data, error } = await authClient.auth.getUser(token)
    if (error || !data?.user) return next()
    req.user = { id: data.user.id, email: data.user.email }
    return next()
  } catch (err) {
    logger.warn({ err: err?.message }, 'optionalAuth failed')
    return next()
  }
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req)
    if (!token || !authClient) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    const { data, error } = await authClient.auth.getUser(token)
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    req.user = { id: data.user.id, email: data.user.email }
    return next()
  } catch (err) {
    logger.warn({ err: err?.message }, 'requireAuth failed')
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

export default { optionalAuth, requireAuth }
