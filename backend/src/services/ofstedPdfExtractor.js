// Ofsted report extractor — fetches inspection report HTML from Ofsted,
// sends to Claude for structured extraction, upserts into nursery_inspection_details.

import axios from 'axios'
import * as cheerio from 'cheerio'
import { callClaude, isClaudeAvailable, ClaudeUnavailableError } from './claudeApi.js'
import db from '../db.js'
import { logger } from '../logger.js'

const OFSTED_REPORT_BASE = 'https://reports.ofsted.gov.uk/provider/16'
const DELAY_MS = 2000 // rate-limit: 2 seconds between Ofsted requests
const CLAUDE_MODEL = 'claude-sonnet-4-6'
const CLAUDE_MAX_TOKENS = 2000

const EXTRACTION_SYSTEM = `You are an expert at extracting structured data from UK Ofsted nursery inspection reports.
You will receive the text content of an Ofsted inspection report for an early years provider.
Extract the requested fields accurately. If a field is not mentioned in the report, use null.
Return ONLY valid JSON — no markdown, no commentary.`

const EXTRACTION_PROMPT = `Extract the following information from this Ofsted inspection report text.
Return a JSON object with these exact keys:

{
  "staff_qualifications": "summary of staff qualifications mentioned (e.g. 'Level 3 qualified staff, Early Years Teacher')",
  "staff_ratios": "any staff-to-child ratios mentioned (e.g. '1:3 for under 2s, 1:4 for 2-3 year olds')",
  "curriculum_approach": "curriculum or pedagogical approach described (e.g. 'EYFS with Montessori elements')",
  "safeguarding_notes": "any safeguarding observations or concerns noted",
  "strengths": ["strength 1", "strength 2", "...up to 5 key strengths"],
  "areas_for_improvement": ["area 1", "area 2", "...up to 5 areas"],
  "parent_feedback_themes": ["theme 1", "theme 2"],
  "key_themes": ["theme 1", "theme 2", "...up to 5 themes"]
}

Use null for any field where the information is not present in the report.
For array fields, use an empty array [] if no items are found.

Here is the report text:

`

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch the Ofsted report page HTML for a given URN.
 * Returns the text content of the report, or null if not found.
 */
async function fetchReportText(urn) {
  const url = `${OFSTED_REPORT_BASE}/${urn}`

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'NurseryMatch/1.0 (nursery comparison site)',
        Accept: 'text/html',
      },
      // Follow redirects
      maxRedirects: 5,
    })

    if (response.status !== 200) {
      logger.warn({ urn, status: response.status }, 'ofsted-extract: non-200 status')
      return null
    }

    const $ = cheerio.load(response.data)

    // Remove script/style/nav elements that pollute the text
    $('script, style, nav, header, footer, .govuk-header, .govuk-footer').remove()

    // Ofsted report pages typically have the report content in the main body area
    // Try several selectors used by Ofsted's report pages
    let reportText = ''

    const contentSelectors = [
      '.inspection-report',
      '#maincontent',
      '.report-content',
      'main',
      '#content',
      'article',
      '.body-content',
    ]

    for (const selector of contentSelectors) {
      const el = $(selector)
      if (el.length > 0) {
        reportText = el.text()
        break
      }
    }

    // Fallback: use the whole body
    if (!reportText.trim()) {
      reportText = $('body').text()
    }

    // Clean up whitespace
    reportText = reportText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim()

    if (reportText.length < 100) {
      logger.warn({ urn, textLength: reportText.length }, 'ofsted-extract: report text too short')
      return null
    }

    // Truncate extremely long reports to stay within Claude context
    if (reportText.length > 15000) {
      reportText = reportText.slice(0, 15000)
    }

    return reportText
  } catch (err) {
    if (err.response?.status === 404) {
      logger.info({ urn }, 'ofsted-extract: report not found (404)')
    } else if (err.code === 'ECONNABORTED') {
      logger.warn({ urn }, 'ofsted-extract: request timed out')
    } else {
      logger.warn({ urn, err: err.message }, 'ofsted-extract: failed to fetch report')
    }
    return null
  }
}

/**
 * Parse Claude's JSON response, handling edge cases.
 */
function parseClaudeResponse(text) {
  if (!text) return null

  // Strip potential markdown code fences
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  try {
    const parsed = JSON.parse(cleaned)
    return parsed
  } catch (err) {
    logger.warn({ err: err.message, responsePreview: cleaned.slice(0, 200) }, 'ofsted-extract: failed to parse Claude response')
    return null
  }
}

/**
 * Extract structured inspection data for a single nursery.
 * @param {string} urn — the nursery URN
 * @returns {object|null} — extracted data or null on failure
 */
export async function extractInspectionReport(urn) {
  if (!isClaudeAvailable()) {
    throw new ClaudeUnavailableError()
  }
  if (!db) {
    throw new Error('Database not configured')
  }

  logger.info({ urn }, 'ofsted-extract: starting extraction')

  // 1. Fetch the nursery's last_inspection_date
  const { data: nursery, error: nurseryErr } = await db
    .from('nurseries')
    .select('urn, last_inspection_date')
    .eq('urn', urn)
    .single()

  if (nurseryErr || !nursery) {
    logger.warn({ urn, error: nurseryErr?.message }, 'ofsted-extract: nursery not found')
    return null
  }

  // 2. Check if we already have details for this URN + date
  const inspDate = nursery.last_inspection_date || null
  if (inspDate) {
    const { data: existing } = await db
      .from('nursery_inspection_details')
      .select('id')
      .eq('urn', urn)
      .eq('inspection_date', inspDate)
      .maybeSingle()

    if (existing) {
      logger.info({ urn }, 'ofsted-extract: already extracted, skipping')
      return { urn, status: 'already_extracted' }
    }
  }

  // 3. Fetch the report text
  const reportText = await fetchReportText(urn)
  if (!reportText) {
    return { urn, status: 'no_report_found' }
  }

  // 4. Send to Claude for extraction
  let extracted = null
  try {
    const response = await callClaude({
      prompt: EXTRACTION_PROMPT + reportText,
      system: EXTRACTION_SYSTEM,
      maxTokens: CLAUDE_MAX_TOKENS,
      model: CLAUDE_MODEL,
    })

    extracted = parseClaudeResponse(response)
  } catch (err) {
    logger.error({ urn, err: err.message }, 'ofsted-extract: Claude extraction failed')
    return { urn, status: 'claude_error', error: err.message }
  }

  if (!extracted) {
    return { urn, status: 'parse_error' }
  }

  // 5. Upsert into nursery_inspection_details
  const row = {
    urn,
    inspection_date: inspDate,
    staff_qualifications: extracted.staff_qualifications || null,
    staff_ratios: extracted.staff_ratios || null,
    curriculum_approach: extracted.curriculum_approach || null,
    safeguarding_notes: extracted.safeguarding_notes || null,
    strengths: Array.isArray(extracted.strengths) ? extracted.strengths : [],
    areas_for_improvement: Array.isArray(extracted.areas_for_improvement) ? extracted.areas_for_improvement : [],
    parent_feedback_themes: Array.isArray(extracted.parent_feedback_themes) ? extracted.parent_feedback_themes : [],
    key_themes: Array.isArray(extracted.key_themes) ? extracted.key_themes : [],
    raw_extract: JSON.stringify(extracted),
    extracted_at: new Date().toISOString(),
  }

  const { error: upsertErr } = await db
    .from('nursery_inspection_details')
    .upsert(row, { onConflict: 'urn,inspection_date' })

  if (upsertErr) {
    logger.error({ urn, error: upsertErr.message }, 'ofsted-extract: upsert failed')
    return { urn, status: 'db_error', error: upsertErr.message }
  }

  logger.info(
    {
      urn,
      strengths: extracted.strengths?.length || 0,
      improvements: extracted.areas_for_improvement?.length || 0,
    },
    'ofsted-extract: extraction complete'
  )

  return { urn, status: 'extracted', data: extracted }
}

/**
 * Batch extract reports for nurseries that don't yet have inspection details.
 * @param {number} limit — max nurseries to process per batch (default 10)
 * @returns {object} — summary of batch results
 */
export async function batchExtractReports(limit = 10) {
  if (!isClaudeAvailable()) {
    throw new ClaudeUnavailableError()
  }
  if (!db) {
    throw new Error('Database not configured')
  }

  logger.info({ limit }, 'ofsted-extract: starting batch extraction')

  // Find nurseries with an inspection date but no extraction yet.
  // Use a LEFT JOIN approach via two queries (Supabase client doesn't support LEFT JOIN directly)
  const { data: alreadyExtracted } = await db
    .from('nursery_inspection_details')
    .select('urn')

  const extractedUrns = new Set((alreadyExtracted || []).map((r) => r.urn))

  // Get active nurseries with an inspection date, preferring those with report URLs
  const { data: candidates, error: candErr } = await db
    .from('nurseries')
    .select('urn, last_inspection_date, inspection_report_url')
    .eq('registration_status', 'Active')
    .not('last_inspection_date', 'is', null)
    .order('last_inspection_date', { ascending: false })
    .limit(limit * 3) // fetch extra since some will be already extracted

  if (candErr) {
    logger.error({ error: candErr.message }, 'ofsted-extract: failed to fetch candidates')
    throw candErr
  }

  // Filter out already extracted
  const toExtract = (candidates || [])
    .filter((n) => !extractedUrns.has(n.urn))
    .slice(0, limit)

  if (toExtract.length === 0) {
    logger.info('ofsted-extract: no nurseries need extraction')
    return { processed: 0, extracted: 0, failed: 0, skipped: 0 }
  }

  let extracted = 0
  let failed = 0
  let skipped = 0

  for (const nursery of toExtract) {
    try {
      const result = await extractInspectionReport(nursery.urn)

      if (result?.status === 'extracted') {
        extracted++
      } else if (result?.status === 'already_extracted') {
        skipped++
      } else {
        failed++
      }
    } catch (err) {
      logger.error({ urn: nursery.urn, err: err.message }, 'ofsted-extract: batch item failed')
      failed++
    }

    // Rate limit: wait between requests to avoid hammering Ofsted
    if (toExtract.indexOf(nursery) < toExtract.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  const summary = {
    processed: toExtract.length,
    extracted,
    failed,
    skipped,
  }

  logger.info(summary, 'ofsted-extract: batch extraction complete')
  return summary
}
