// Supabase client — used by all services
// Uses service key for backend operations (bypasses Row Level Security)
// Starts gracefully without credentials (health endpoint still works)

import { createClient } from '@supabase/supabase-js'

let db = null

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: { persistSession: false },
      db: { schema: 'public' },
    }
  )
} else {
  console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_KEY not set — database features disabled')
  console.warn('   The server will start but API routes that need the database will return errors.')
  console.warn('   Set these in backend/.env to enable full functionality.')
}

export default db
