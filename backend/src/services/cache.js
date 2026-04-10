// In-memory cache for search results and geocoding
// Saves repeated PostGIS queries for the same search

import NodeCache from 'node-cache'

// Search results: 1 hour TTL
export const searchCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 })

// Postcode geocoding: 24 hour TTL (postcodes don't change)
export const geocodeCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 })

// Autocomplete suggestions: 60 second TTL
export const autocompleteCache = new NodeCache({ stdTTL: 60, checkperiod: 30 })

export function searchCacheKey(params) {
  const { postcode, radiusKm, grade, funded2yr, funded3yr } = params
  return `search:${postcode}:${radiusKm}:${grade || 'any'}:${funded2yr}:${funded3yr}`
}
