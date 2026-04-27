import pino from 'pino'

// Redact common PII / secret paths so structured logs are safe to ship to
// Sentry / Render / wherever. Pino's `redact` replaces matched paths with
// '[Redacted]' before serialization, no perf cost when the path doesn't
// exist on the log object.
//
// Add to this list anything you discover the codebase logs that shouldn't
// land in long-term log storage. See backend/src/services/* for examples
// of what we deliberately *do* log (counts, IDs — never bodies).
const REDACT_PATHS = [
  // Auth tokens passed in headers
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  // Passwords accidentally landing in a body log
  'req.body.password',
  'req.body.confirmPassword',
  '*.password',
  '*.confirmPassword',
  // Common secret env-style names
  '*.api_key',
  '*.apiKey',
  '*.secret',
  '*.token',
  // Plain emails — not strictly secret but PII; redact in non-error logs.
  // We deliberately don't redact 'email' on errors since debugging often
  // needs the address. Redact on req.body to avoid accidental capture.
  'req.body.email',
  // Stripe + Supabase service keys if accidentally serialized.
  '*.stripe_secret_key',
  '*.supabase_service_key',
  '*.service_role_key',
]

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: REDACT_PATHS,
    censor: '[Redacted]',
    remove: false,
  },
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
})
