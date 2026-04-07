// Generate a warm 3-sentence paragraph explaining a match.
// No cache — depends on user preferences which vary per request.

import { callClaude } from './claudeApi.js'

const SYSTEM_PROMPT =
  'You write a warm, factual 3-sentence paragraph for UK parents explaining why a nursery ' +
  'fits their priorities. Use only the provided facts and rationale items — do not invent. ' +
  'Tone: friendly, concise, no marketing fluff. Plain text only, no markdown.'

export async function generateMatchNarrative(nursery, area, match) {
  const facts = {
    nursery: nursery
      ? {
          name: nursery.name,
          town: nursery.town,
          ofsted_grade: nursery.ofsted_overall_grade,
          total_places: nursery.total_places,
          funded_2yr_places: nursery.places_funded_2yr,
          funded_3_4yr_places: nursery.places_funded_3_4yr,
        }
      : null,
    area: area
      ? {
          family_score: area.family_score,
          crime_rate_per_1000: area.crime_rate_per_1000,
          imd_decile: area.imd_decile,
          nursery_outstanding_pct: area.nursery_outstanding_pct,
        }
      : null,
    match: match
      ? {
          score: match.score,
          rationale: match.rationale || match.reasons || [],
        }
      : null,
  }

  const prompt =
    'Write exactly 3 sentences explaining the fit, based ONLY on these facts:\n' +
    JSON.stringify(facts)

  const text = await callClaude({ prompt, system: SYSTEM_PROMPT, maxTokens: 200 })
  return (text || '').trim()
}
