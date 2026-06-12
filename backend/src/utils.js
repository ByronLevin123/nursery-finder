export function escapeLike(str) {
  return str.replace(/[%_\\]/g, '\\$&')
}

// Replace secret-bearing query parameter values in a URL/path with [Redacted]
// before it lands in logs. The pino redact list can't reach inside req.url,
// so request logging passes URLs through this first (api_key is a documented
// query-string credential for the developer API).
const SECRET_QUERY_PARAMS = /([?&](?:api_key|apikey|token|access_token|key|secret)=)[^&#]*/gi

export function scrubUrlSecrets(url) {
  if (typeof url !== 'string') return url
  return url.replace(SECRET_QUERY_PARAMS, '$1[Redacted]')
}
