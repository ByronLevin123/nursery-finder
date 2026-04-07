import { describe, it, expect } from 'vitest'
import { parseSchoolRow } from '../src/services/schoolsIngest.js'

const validRow = {
  URN: '100001',
  EstablishmentName: 'St Mary Primary',
  'PhaseOfEducation (name)': 'Primary',
  Postcode: 'sw11 6qt',
  'OfstedRating (name)': 'Good',
  OfstedLastInsp: '15-03-2023',
  'LA (name)': 'Wandsworth',
}

describe('parseSchoolRow', () => {
  it('parses a valid GIAS row', () => {
    const r = parseSchoolRow(validRow)
    expect(r).toEqual({
      urn: 100001,
      name: 'St Mary Primary',
      phase: 'Primary',
      postcode: 'SW11 6QT',
      ofsted_grade: 'Good',
      last_inspection_date: '2023-03-15',
      local_authority: 'Wandsworth',
    })
  })

  it('returns null when URN missing or invalid', () => {
    expect(parseSchoolRow({ ...validRow, URN: '' })).toBeNull()
    expect(parseSchoolRow({ ...validRow, URN: 'abc' })).toBeNull()
  })

  it('returns null when name missing', () => {
    expect(parseSchoolRow({ ...validRow, EstablishmentName: '   ' })).toBeNull()
  })

  it('handles missing optional fields gracefully', () => {
    const r = parseSchoolRow({
      URN: '200002',
      EstablishmentName: 'Some School',
    })
    expect(r.urn).toBe(200002)
    expect(r.phase).toBeNull()
    expect(r.postcode).toBeNull()
    expect(r.ofsted_grade).toBeNull()
    expect(r.last_inspection_date).toBeNull()
    expect(r.local_authority).toBeNull()
  })

  it('handles ISO-format inspection date', () => {
    const r = parseSchoolRow({ ...validRow, OfstedLastInsp: '2024-01-10' })
    expect(r.last_inspection_date).toBe('2024-01-10')
  })

  it('returns null for non-object input', () => {
    expect(parseSchoolRow(null)).toBeNull()
    expect(parseSchoolRow('foo')).toBeNull()
  })
})
