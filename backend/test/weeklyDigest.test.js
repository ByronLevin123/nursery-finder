import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { createMockDb } from './helpers/mockDb.js'

const { db, setTable } = createMockDb()

// Map user id -> email, resolved through the supabase auth admin API.
const emailById = {
  'u-legacy': 'legacy@example.com',
  'u-both': 'both@example.com',
}
db.auth = {
  admin: {
    getUserById: async (id) => ({ data: { user: { email: emailById[id] || null } } }),
  },
}

vi.mock('../src/db.js', () => ({ default: db }))

const sendEmail = vi.fn(async () => ({ messageId: 'm-1' }))
vi.mock('../src/services/emailService.js', () => ({ sendEmail }))

vi.mock('../src/services/emailTemplates.js', () => ({
  renderWeeklyDigestEmail: () => ({
    subject: 'New nurseries near you',
    html: '<p>hi</p>',
    text: 'hi',
  }),
}))

// Imported dynamically after the mocks above are wired (weeklyDigest pulls in
// db.js at module-eval time, which must resolve to the mock).
let sendWeeklyDigests

const NOW = new Date().toISOString()

beforeAll(async () => {
  ;({ sendWeeklyDigests } = await import('../src/services/weeklyDigest.js'))
})

beforeEach(() => {
  vi.clearAllMocks()
  setTable('user_profiles', [
    {
      id: 'u-legacy',
      display_name: 'Legacy',
      home_postcode: 'SW1A 1AA',
      email_weekly_digest: true,
    },
    { id: 'u-both', display_name: 'Both', home_postcode: 'SW1A 1AA', email_weekly_digest: true },
  ])
  // u-both also opted into the enhanced digest, so the legacy digest must skip them.
  setTable('notification_preferences', [{ user_id: 'u-both', email_weekly_digest: true }])
  setTable('nurseries', [
    {
      urn: '1',
      name: 'Sunny Days',
      ofsted_overall_grade: 'Good',
      town: 'London',
      postcode: 'SW1A 1AB',
      updated_at: NOW,
    },
  ])
  setTable('email_log', [])
})

describe('sendWeeklyDigests dedup', () => {
  it('skips users already covered by the enhanced digest and emails the rest', async () => {
    const result = await sendWeeklyDigests()

    // Only the legacy-only user is emailed; u-both is deduped.
    expect(result.sent).toBe(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'legacy@example.com' }))
    expect(sendEmail).not.toHaveBeenCalledWith(expect.objectContaining({ to: 'both@example.com' }))
  })

  it('emails everyone when no one is in the enhanced list', async () => {
    setTable('notification_preferences', [])
    const result = await sendWeeklyDigests()
    expect(result.sent).toBe(2)
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })
})
