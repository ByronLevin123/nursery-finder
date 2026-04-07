import express from 'express'
import db from '../db.js'

const router = express.Router()

router.get('/', async (req, res) => {
  if (!db) {
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'not configured',
      nursery_count: 0,
      geocoded_count: 0,
      message:
        'Server running. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env to enable database.',
    })
  }

  try {
    const { count } = await db
      .from('nurseries')
      .select('*', { count: 'exact', head: true })
      .eq('registration_status', 'Active')

    const { count: geocoded } = await db
      .from('nurseries')
      .select('*', { count: 'exact', head: true })
      .eq('registration_status', 'Active')
      .not('lat', 'is', null)

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'connected',
      nursery_count: count,
      geocoded_count: geocoded,
    })
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message })
  }
})

export default router
