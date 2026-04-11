// Provider reports — analytics for claimed nurseries
// Mounted at /api/v1/provider/reports

import express from 'express'
import db from '../db.js'
import { logger } from '../logger.js'
import { requireAuth } from '../middleware/supabaseAuth.js'

const router = express.Router()

// GET /reports — time-series analytics for provider's nurseries
router.get('/reports', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { range = '30' } = req.query
    const days = parseInt(range) || 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    // Get provider's claimed nurseries
    const { data: claims, error: claimsErr } = await db
      .from('nursery_claims')
      .select('urn')
      .eq('user_id', req.user.id)
      .eq('status', 'approved')

    if (claimsErr) throw claimsErr
    if (!claims || claims.length === 0) {
      return res.json({
        summary: { views: 0, enquiries: 0, compares: 0, shortlists: 0 },
        timeseries: [],
        conversion_rate: 0,
      })
    }

    const urns = claims.map((c) => c.urn)

    // Fetch cached report data
    const { data: reports, error: repErr } = await db
      .from('provider_reports_cache')
      .select('*')
      .in('urn', urns)
      .gte('report_date', startDateStr)
      .order('report_date', { ascending: true })

    if (repErr) throw repErr

    // Aggregate totals
    const summary = { views: 0, enquiries: 0, compares: 0, shortlists: 0 }
    const dateMap = new Map()

    for (const r of reports || []) {
      summary.views += r.views || 0
      summary.enquiries += r.enquiries || 0
      summary.compares += r.compares || 0
      summary.shortlists += r.shortlists || 0

      const existing = dateMap.get(r.report_date) || { date: r.report_date, views: 0, enquiries: 0, compares: 0, shortlists: 0 }
      existing.views += r.views || 0
      existing.enquiries += r.enquiries || 0
      existing.compares += r.compares || 0
      existing.shortlists += r.shortlists || 0
      dateMap.set(r.report_date, existing)
    }

    const timeseries = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    const conversion_rate = summary.views > 0
      ? Math.round((summary.enquiries / summary.views) * 10000) / 100
      : 0

    res.json({ summary, timeseries, conversion_rate })
  } catch (err) {
    logger.error({ err: err.message, userId: req.user.id }, 'providerReports: fetch failed')
    next(err)
  }
})

// GET /reports/export — CSV export
router.get('/reports/export', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { range = '30' } = req.query
    const days = parseInt(range) || 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    const { data: claims } = await db
      .from('nursery_claims')
      .select('urn')
      .eq('user_id', req.user.id)
      .eq('status', 'approved')

    if (!claims || claims.length === 0) {
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename="provider-reports.csv"')
      return res.send('date,urn,views,enquiries,compares,shortlists\n')
    }

    const urns = claims.map((c) => c.urn)

    const { data: reports, error } = await db
      .from('provider_reports_cache')
      .select('*')
      .in('urn', urns)
      .gte('report_date', startDateStr)
      .order('report_date', { ascending: true })

    if (error) throw error

    const rows = ['date,urn,views,enquiries,compares,shortlists']
    for (const r of reports || []) {
      rows.push(`${r.report_date},${r.urn},${r.views || 0},${r.enquiries || 0},${r.compares || 0},${r.shortlists || 0}`)
    }

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="provider-reports-${days}d.csv"`)
    res.send(rows.join('\n'))
  } catch (err) {
    logger.error({ err: err.message, userId: req.user.id }, 'providerReports: export failed')
    next(err)
  }
})

export default router
