// Admin-facing Google Search Console endpoints.
//
// Surfaces the same organic clicks/impressions Google reports in its own
// Search Console UI, so the admin dashboard can be compared against the
// platform's first-party activity stats.

import express from 'express'
import { requireRole } from '../middleware/supabaseAuth.js'
import * as searchConsole from '../services/searchConsole.js'

const router = express.Router()

// GET /api/v1/admin/search-console/site?days=28 — site-wide totals.
// This is the figure Search Console shows on its overview ("53 clicks").
router.get('/site', requireRole('admin'), async (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 28, 1), 90)

    if (!searchConsole.isConfigured()) {
      return res.json({ configured: false, window_days: days, site: null, nurseries: [] })
    }

    const [site, byUrn] = await Promise.all([
      searchConsole.getSiteTotals({ days }),
      searchConsole.getStatsByUrn({ days }),
    ])

    // Top nursery profiles by organic clicks, for a quick comparison table.
    const nurseries = Array.from(byUrn.entries())
      .map(([urn, stats]) => ({ urn, ...stats }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50)

    return res.json({ configured: true, window_days: days, site, nurseries })
  } catch (err) {
    next(err)
  }
})

export default router
