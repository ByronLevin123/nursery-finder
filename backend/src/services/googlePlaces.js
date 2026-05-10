// Google Places API (New) — enriches nurseries with ratings, review counts, and photos.
//
// Flow:
// 1. Find nurseries missing google_place_id (or stale data)
// 2. Text Search to match nursery name + location → get place_id
// 3. Place Details to get rating, review count, photos
// 4. (Optional) Download first photo and store URL in nursery_photos
//
// Rate limiting: 200ms between requests to stay well within quotas.
// Free tier gives $200/month ≈ 10,000 Place Details calls.

import db from '../db.js'
import { logger } from '../logger.js'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY
const RATE_LIMIT_MS = 200
const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places'
const PHOTO_URL_BASE = 'https://places.googleapis.com/v1'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Find a nursery's Google Place ID using Text Search (New).
 * Searches for nursery name near its lat/lng.
 */
async function findPlaceId(nursery) {
  const query = `${nursery.name} nursery`
  const body = {
    textQuery: query,
    locationBias: {
      circle: {
        center: { latitude: nursery.lat, longitude: nursery.lng },
        radius: 1000.0, // 1km radius
      },
    },
    maxResultCount: 3,
  }

  const res = await fetch(TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.photos',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Text Search failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  if (!data.places || data.places.length === 0) {
    return null
  }

  // Return the best match — first result near the nursery
  return data.places[0]
}

/**
 * Get a photo URL for a place. Uses the Places Photo (New) API.
 * Returns a publicly accessible URL.
 */
async function getPhotoUrl(photoName, maxWidth = 800) {
  // The photo name is like "places/xxx/photos/yyy"
  // URL format: https://places.googleapis.com/v1/{name}/media?maxWidthPx=800&key=API_KEY
  const url = `${PHOTO_URL_BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${API_KEY}&skipHttpRedirect=true`

  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) return null

  const data = await res.json()
  return data.photoUri || null
}

/**
 * Sync Google Places data for nurseries.
 *
 * @param {number} limit - Max nurseries to process
 * @param {object} options
 * @param {number} options.staleDays - Re-fetch if data older than this (default 90)
 * @param {boolean} options.photosEnabled - Also fetch and store photos (default true)
 * @returns {{ matched: number, updated: number, failed: number, skipped: number, photos: number }}
 */
export async function syncGooglePlacesData(
  limit = 100,
  { staleDays = 90, photosEnabled = true } = {}
) {
  if (!API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY not set')
  }
  if (!db) {
    throw new Error('Database not configured')
  }

  // Find nurseries that need Google data:
  // 1. No google_place_id (never matched)
  // 2. Or stale data (google_place_id exists but hasn't been refreshed recently)
  // Must have lat/lng for location bias
  const staleDate = new Date(Date.now() - staleDays * 86400000).toISOString()

  const { data: nurseries, error: fetchErr } = await db
    .from('nurseries')
    .select('id, urn, name, lat, lng, postcode, town, google_place_id, google_rating')
    .eq('registration_status', 'Active')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .is('google_place_id', null)
    .limit(limit)

  if (fetchErr) throw fetchErr

  if (!nurseries?.length) {
    logger.info('google-places: no nurseries need enrichment')
    return { matched: 0, updated: 0, failed: 0, skipped: 0, photos: 0 }
  }

  logger.info({ count: nurseries.length }, 'google-places: starting batch sync')

  let matched = 0
  let updated = 0
  let failed = 0
  let skipped = 0
  let photosAdded = 0

  for (const nursery of nurseries) {
    try {
      await sleep(RATE_LIMIT_MS)

      // Step 1: Find the place
      const place = await findPlaceId(nursery)

      if (!place) {
        skipped++
        logger.debug({ urn: nursery.urn, name: nursery.name }, 'google-places: no match found')
        // Mark as attempted so we don't retry endlessly
        await db.from('nurseries').update({ google_place_id: 'NOT_FOUND' }).eq('id', nursery.id)
        continue
      }

      matched++

      // Step 2: Extract rating data from the search result
      const placeId = place.id
      const rating = place.rating ?? null
      const reviewCount = place.userRatingCount ?? null

      // Step 3: Update nursery record
      const { error: updateErr } = await db
        .from('nurseries')
        .update({
          google_place_id: placeId,
          google_rating: rating,
          google_review_count: reviewCount,
        })
        .eq('id', nursery.id)

      if (updateErr) {
        logger.warn({ urn: nursery.urn, err: updateErr.message }, 'google-places: update failed')
        failed++
        continue
      }

      updated++

      // Step 4: Fetch first photo if available
      if (photosEnabled && place.photos && place.photos.length > 0) {
        try {
          await sleep(RATE_LIMIT_MS)
          const photoUrl = await getPhotoUrl(place.photos[0].name)
          if (photoUrl) {
            // Check if nursery already has photos
            const { data: existingPhotos } = await db
              .from('nursery_photos')
              .select('id')
              .eq('nursery_urn', nursery.urn)
              .limit(1)

            if (!existingPhotos || existingPhotos.length === 0) {
              const { error: photoErr } = await db.from('nursery_photos').insert({
                nursery_urn: nursery.urn,
                storage_path: `google/${placeId}/0.jpg`,
                public_url: photoUrl,
                display_order: 0,
                caption: `Photo of ${nursery.name}`,
              })

              if (!photoErr) {
                photosAdded++
              } else {
                logger.warn(
                  { urn: nursery.urn, err: photoErr.message },
                  'google-places: photo insert failed'
                )
              }
            }
          }
        } catch (photoErr) {
          logger.warn(
            { urn: nursery.urn, err: photoErr.message },
            'google-places: photo fetch failed'
          )
        }
      }

      if (updated % 50 === 0) {
        logger.info({ updated, matched, failed, skipped }, 'google-places: progress')
      }
    } catch (err) {
      failed++
      logger.warn({ urn: nursery.urn, err: err.message }, 'google-places: nursery sync failed')
    }
  }

  const result = { matched, updated, failed, skipped, photos: photosAdded }
  logger.info(result, 'google-places: batch sync complete')
  return result
}

/**
 * Refresh stale Google data — re-fetch for nurseries that already have place_id
 * but haven't been updated in staleDays.
 */
export async function refreshStaleGoogleData(limit = 100, staleDays = 90) {
  if (!API_KEY) throw new Error('GOOGLE_PLACES_API_KEY not set')
  if (!db) throw new Error('Database not configured')

  // For refresh, we want nurseries that HAVE a place_id but haven't been updated recently.
  // Since we don't track google_updated_at, we'll use a simple approach:
  // just re-fetch details for nurseries with an existing place_id.
  const { data: nurseries, error } = await db
    .from('nurseries')
    .select('id, urn, name, google_place_id')
    .eq('registration_status', 'Active')
    .not('google_place_id', 'is', null)
    .neq('google_place_id', 'NOT_FOUND')
    .limit(limit)

  if (error) throw error
  if (!nurseries?.length) return { refreshed: 0, failed: 0 }

  logger.info({ count: nurseries.length }, 'google-places: refreshing stale data')

  let refreshed = 0
  let failed = 0

  for (const nursery of nurseries) {
    try {
      await sleep(RATE_LIMIT_MS)

      // Use Place Details (New) to get fresh rating
      const url = `${PLACE_DETAILS_URL}/${nursery.google_place_id}`
      const res = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'rating,userRatingCount',
        },
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        failed++
        continue
      }

      const place = await res.json()
      const { error: updateErr } = await db
        .from('nurseries')
        .update({
          google_rating: place.rating ?? null,
          google_review_count: place.userRatingCount ?? null,
        })
        .eq('id', nursery.id)

      if (updateErr) {
        failed++
      } else {
        refreshed++
      }
    } catch (err) {
      failed++
      logger.warn({ urn: nursery.urn, err: err.message }, 'google-places: refresh failed')
    }
  }

  const result = { refreshed, failed }
  logger.info(result, 'google-places: stale refresh complete')
  return result
}
