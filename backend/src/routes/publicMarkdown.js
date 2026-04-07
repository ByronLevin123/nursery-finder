import express from 'express'
import db from '../db.js'
import { logger } from '../logger.js'

const router = express.Router()

const SITE = 'https://nursery-finder.vercel.app'

function md(res, text) {
  res.set('Content-Type', 'text/markdown; charset=utf-8')
  res.set('Cache-Control', 'public, max-age=3600')
  res.send(text)
}

function fmtPrice(n) {
  if (n == null) return 'n/a'
  return `£${Math.round(Number(n)).toLocaleString()}`
}

// GET /api/v1/public/nursery/:urn.md
router.get('/nursery/:urn.md', async (req, res, next) => {
  try {
    const { data, error } = await db
      .from('nurseries')
      .select('*')
      .eq('urn', req.params.urn)
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).type('text/markdown').send('# Not found\n')

    const lines = []
    lines.push(`# ${data.name}`)
    lines.push('')
    lines.push(`> Ofsted grade: **${data.ofsted_overall_grade || 'Not yet rated'}**`)
    lines.push(`> URN: ${data.urn}`)
    lines.push('')
    lines.push('## Address')
    lines.push(
      [data.address_line1, data.address_line2, data.town, data.postcode].filter(Boolean).join(', ')
    )
    if (data.local_authority) lines.push(`Local authority: ${data.local_authority}`)
    lines.push('')
    lines.push('## Ofsted')
    lines.push(`- Grade: ${data.ofsted_overall_grade || 'n/a'}`)
    if (data.last_inspection_date) lines.push(`- Last inspected: ${data.last_inspection_date}`)
    if (data.inspection_report_url) lines.push(`- Report: ${data.inspection_report_url}`)
    if (data.enforcement_notice) lines.push(`- ⚠️ Enforcement notice on file`)
    lines.push('')
    lines.push('## Places')
    if (data.total_places) lines.push(`- Total places: ${data.total_places}`)
    if (data.places_funded_2yr) lines.push(`- Funded 2yr: ${data.places_funded_2yr}`)
    if (data.places_funded_3_4yr) lines.push(`- Funded 3-4yr: ${data.places_funded_3_4yr}`)
    if (data.fee_avg_monthly)
      lines.push(
        `- Average fees: £${data.fee_avg_monthly}/month (${data.fee_report_count || 0} reports)`
      )
    lines.push('')
    if (data.description) {
      lines.push('## About')
      lines.push(data.description)
      lines.push('')
    }
    lines.push('## Contact')
    if (data.phone) lines.push(`- Phone: ${data.phone}`)
    if (data.email) lines.push(`- Email: ${data.email}`)
    if (data.website) lines.push(`- Website: ${data.website}`)
    lines.push('')
    lines.push(`## Live page`)
    lines.push(`${SITE}/nursery/${data.urn}`)
    lines.push('')
    lines.push('---')
    lines.push('Source: Ofsted Early Years register (Open Government Licence v3.0).')

    md(res, lines.join('\n'))
  } catch (err) {
    logger.error({ err: err.message }, 'public md nursery failed')
    next(err)
  }
})

// GET /api/v1/public/area/:district.md
router.get('/area/:district.md', async (req, res, next) => {
  try {
    const district = req.params.district.toUpperCase()

    const { data: area, error } = await db
      .from('postcode_areas')
      .select('*')
      .eq('postcode_district', district)
      .maybeSingle()

    if (error) throw error
    if (!area) return res.status(404).type('text/markdown').send('# Not found\n')

    const { data: topNurseries } = await db
      .from('nurseries')
      .select('urn, name, ofsted_overall_grade, postcode')
      .eq('registration_status', 'Active')
      .like('postcode', `${district}%`)
      .order('ofsted_overall_grade', { ascending: true, nullsFirst: false })
      .limit(5)

    const lines = []
    lines.push(`# ${district}${area.local_authority ? ` — ${area.local_authority}` : ''}`)
    lines.push('')
    lines.push(`> Family score: **${area.family_score ?? 'n/a'} / 100**`)
    lines.push('')
    lines.push('## Nurseries')
    lines.push(`- Total: ${area.nursery_count_total ?? 0}`)
    lines.push(`- Outstanding: ${area.nursery_count_outstanding ?? 0}`)
    lines.push(`- Good: ${area.nursery_count_good ?? 0}`)
    lines.push(`- % Outstanding: ${area.nursery_outstanding_pct ?? 0}%`)
    lines.push('')
    lines.push('## Property')
    lines.push(`- Avg sale price: ${fmtPrice(area.avg_sale_price_all)}`)
    lines.push(`- Avg flat: ${fmtPrice(area.avg_sale_price_flat)}`)
    lines.push(`- Avg terraced: ${fmtPrice(area.avg_sale_price_terraced)}`)
    lines.push(`- Avg semi: ${fmtPrice(area.avg_sale_price_semi)}`)
    lines.push(`- Avg detached: ${fmtPrice(area.avg_sale_price_detached)}`)
    if (area.gross_yield_pct) lines.push(`- Gross yield: ${area.gross_yield_pct}%`)
    if (area.price_growth_1yr_pct) lines.push(`- 1yr growth: ${area.price_growth_1yr_pct}%`)
    lines.push('')
    lines.push('## Safety & environment')
    if (area.crime_rate_per_1000 != null)
      lines.push(`- Crime rate: ${area.crime_rate_per_1000} per 1,000`)
    if (area.imd_decile != null) lines.push(`- IMD decile: ${area.imd_decile}/10`)
    if (area.flood_risk_level) lines.push(`- Flood risk: ${area.flood_risk_level}`)
    lines.push('')
    lines.push('## Parks & schools')
    if (area.nearest_park_name)
      lines.push(`- Nearest park: ${area.nearest_park_name} (${area.nearest_park_distance_m}m)`)
    if (area.park_count_within_1km) lines.push(`- Parks within 1km: ${area.park_count_within_1km}`)
    lines.push('')
    if (topNurseries && topNurseries.length > 0) {
      lines.push('## Top nurseries')
      for (const n of topNurseries) {
        lines.push(
          `- [${n.name}](${SITE}/nursery/${n.urn}) — ${n.ofsted_overall_grade || 'not rated'}`
        )
      }
      lines.push('')
    }
    lines.push(`## Live page`)
    lines.push(`${SITE}/nurseries-in/${district.toLowerCase()}`)
    lines.push('')
    lines.push('---')
    lines.push('Sources: Ofsted, HM Land Registry, ONS, data.police.uk, Environment Agency.')

    md(res, lines.join('\n'))
  } catch (err) {
    logger.error({ err: err.message }, 'public md area failed')
    next(err)
  }
})

export default router
