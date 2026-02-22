# Database Migrations

## Rules

1. Never edit a migration file after it has been run in Supabase
2. New schema changes = new numbered file (002_add_fees.sql, etc.)
3. Each file must be self-contained and idempotent (use IF NOT EXISTS)
4. Run files in Supabase: Project → SQL Editor → New query → paste → Run

## Files

| File | Description | Status |
|------|-------------|--------|
| 001_initial_schema.sql | Core tables, indexes, functions | ⬜ Not run yet |

## How to run a migration

1. Open your Supabase project
2. Go to SQL Editor → New query
3. Paste the entire migration file
4. Click Run
5. Update status in this table to ✅
