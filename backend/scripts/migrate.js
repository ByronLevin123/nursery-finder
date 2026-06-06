// Migration runner — applies pending SQL migrations and records them in the
// schema_migrations table, so "what's applied?" is always answerable.
//
// Usage (from backend/):
//   DATABASE_URL=postgres://... npm run migrate:status     # list applied/pending
//   DATABASE_URL=postgres://... npm run migrate            # apply pending
//   DATABASE_URL=postgres://... npm run migrate:baseline   # adopt an existing DB
//
// DATABASE_URL is the Supabase Postgres connection string
// (Supabase → Project Settings → Database → Connection string → URI).
//
// Adopting an already-migrated database: run `migrate:baseline` ONCE. It records
// every current migration file as applied WITHOUT executing any SQL, so the old
// migrations are never re-run. After that, `migrate` only runs genuinely new files.

import { readdirSync, readFileSync } from 'fs'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'database', 'migrations')

const ENSURE_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    checksum   TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`

// ---- Pure helpers (unit-tested) -------------------------------------------

export function versionOf(filename) {
  return filename.replace(/\.sql$/, '')
}

export function listMigrationFiles(dir = MIGRATIONS_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

// Given all migration filenames and the versions already applied, return the
// sorted list of files still pending.
export function planMigrations(allFiles, appliedVersions) {
  const applied = new Set(appliedVersions)
  const all = [...allFiles].sort()
  const pending = all.filter((f) => !applied.has(versionOf(f)))
  return { all, pending }
}

export function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex')
}

// ---- DB plumbing -----------------------------------------------------------

async function getClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set (Supabase → Settings → Database → Connection string)')
  }
  const client = new pg.Client({
    connectionString,
    ssl: process.env.PGSSL_DISABLE ? false : { rejectUnauthorized: false },
  })
  await client.connect()
  return client
}

async function appliedVersions(client) {
  await client.query(ENSURE_TABLE)
  const { rows } = await client.query('SELECT version FROM schema_migrations')
  return rows.map((r) => r.version)
}

async function record(client, file, sql) {
  await client.query(
    'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
    [versionOf(file), checksum(sql)]
  )
}

// ---- Commands --------------------------------------------------------------

async function cmdStatus() {
  const client = await getClient()
  try {
    const applied = await appliedVersions(client)
    const { all, pending } = planMigrations(listMigrationFiles(), applied)
    console.log(`Total migrations: ${all.length} | applied: ${applied.length} | pending: ${pending.length}`)
    for (const f of pending) console.log('  pending →', f)
    if (pending.length === 0) console.log('  (up to date)')
  } finally {
    await client.end()
  }
}

async function cmdApply() {
  const client = await getClient()
  try {
    const applied = await appliedVersions(client)
    const { pending } = planMigrations(listMigrationFiles(), applied)
    if (pending.length === 0) {
      console.log('No pending migrations.')
      return
    }
    for (const file of pending) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      console.log('Applying', file, '…')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await record(client, file, sql)
        await client.query('COMMIT')
        console.log('  ✓', file)
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`Migration ${file} failed (rolled back): ${err.message}`)
      }
    }
    console.log(`Applied ${pending.length} migration(s).`)
  } finally {
    await client.end()
  }
}

async function cmdBaseline() {
  const client = await getClient()
  try {
    await client.query(ENSURE_TABLE)
    const files = listMigrationFiles()
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      await record(client, file, sql)
    }
    console.log(`Baselined ${files.length} migration(s) as applied (no SQL executed).`)
  } finally {
    await client.end()
  }
}

async function main() {
  const cmd = process.argv[2] || 'status'
  if (cmd === 'status') return cmdStatus()
  if (cmd === 'apply') return cmdApply()
  if (cmd === 'baseline') return cmdBaseline()
  console.error(`Unknown command "${cmd}". Use: status | apply | baseline`)
  process.exit(1)
}

// Only run the CLI when invoked directly (not when imported by tests).
const isMain = process.argv[1] && process.argv[1].endsWith('migrate.js')
if (isMain) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
