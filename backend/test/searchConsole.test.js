import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import * as searchConsole from '../src/services/searchConsole.js'

// These tests cover the graceful-degradation contract: with no credentials the
// service must never throw and must return null / empty results so the
// dashboards keep working without Search Console configured.

const GSC_VARS = ['GSC_SITE_URL', 'GSC_CLIENT_ID', 'GSC_CLIENT_SECRET', 'GSC_REFRESH_TOKEN']
const ADS_VARS = ['GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET']

describe('searchConsole service (unconfigured)', () => {
  const saved = {}

  beforeEach(() => {
    for (const k of [...GSC_VARS, ...ADS_VARS]) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterEach(() => {
    for (const k of [...GSC_VARS, ...ADS_VARS]) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('reports not configured when env vars are missing', () => {
    expect(searchConsole.isConfigured()).toBe(false)
  })

  it('still reports not configured with only a site url', () => {
    process.env.GSC_SITE_URL = 'sc-domain:nurserymatch.com'
    expect(searchConsole.isConfigured()).toBe(false)
  })

  it('reports configured once site + oauth creds are present', () => {
    process.env.GSC_SITE_URL = 'sc-domain:nurserymatch.com'
    process.env.GSC_CLIENT_ID = 'id'
    process.env.GSC_CLIENT_SECRET = 'secret'
    process.env.GSC_REFRESH_TOKEN = 'token'
    expect(searchConsole.isConfigured()).toBe(true)
  })

  it('falls back to GOOGLE_ADS client id/secret', () => {
    process.env.GSC_SITE_URL = 'sc-domain:nurserymatch.com'
    process.env.GOOGLE_ADS_CLIENT_ID = 'id'
    process.env.GOOGLE_ADS_CLIENT_SECRET = 'secret'
    process.env.GSC_REFRESH_TOKEN = 'token'
    expect(searchConsole.isConfigured()).toBe(true)
  })

  it('getSiteTotals resolves to null when unconfigured', async () => {
    await expect(searchConsole.getSiteTotals()).resolves.toBeNull()
  })

  it('getStatsByUrn resolves to an empty Map when unconfigured', async () => {
    const result = await searchConsole.getStatsByUrn()
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })
})
