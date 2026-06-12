import { describe, it, expect } from 'vitest'
import { versionOf, planMigrations, checksum, listMigrationFiles } from '../scripts/migrate.js'

describe('versionOf', () => {
  it('strips the .sql extension', () => {
    expect(versionOf('060_marketing_hub_fe_alignment.sql')).toBe('060_marketing_hub_fe_alignment')
  })
})

describe('planMigrations', () => {
  const files = ['001_a.sql', '002_b.sql', '003_c.sql']

  it('returns files whose version is not yet applied, sorted', () => {
    const { pending } = planMigrations(files, ['001_a', '002_b'])
    expect(pending).toEqual(['003_c.sql'])
  })

  it('returns nothing pending when all are applied', () => {
    const { pending } = planMigrations(files, ['001_a', '002_b', '003_c'])
    expect(pending).toEqual([])
  })

  it('returns everything when nothing is applied (fresh DB)', () => {
    const { pending } = planMigrations(files, [])
    expect(pending).toEqual(files)
  })

  it('sorts regardless of input order', () => {
    const { all } = planMigrations(['003_c.sql', '001_a.sql', '002_b.sql'], [])
    expect(all).toEqual(['001_a.sql', '002_b.sql', '003_c.sql'])
  })
})

describe('checksum', () => {
  it('is deterministic and content-sensitive', () => {
    expect(checksum('SELECT 1')).toBe(checksum('SELECT 1'))
    expect(checksum('SELECT 1')).not.toBe(checksum('SELECT 2'))
  })
})

describe('listMigrationFiles', () => {
  it('reads the real migrations dir: sorted .sql files including the new ones', () => {
    const files = listMigrationFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.every((f) => f.endsWith('.sql'))).toBe(true)
    expect([...files]).toEqual([...files].sort())
    expect(files).toContain('062_schema_migrations.sql')
  })
})
