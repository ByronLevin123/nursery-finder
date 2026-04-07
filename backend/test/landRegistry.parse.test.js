import { describe, it, expect } from 'vitest'
import { parseLandRegistryRow, extractDistrict } from '../src/services/landRegistry.js'

const validRow = [
  '{ABC}',
  '450000',
  '2024-06-01 00:00',
  'SW11 6QT',
  'D',
  'N',
  'F',
  '',
  '12',
  'Some Street',
  '',
  'London',
  'Wandsworth',
  'Greater London',
  'A',
  'A',
]

describe('parseLandRegistryRow', () => {
  it('parses a valid row', () => {
    const r = parseLandRegistryRow(validRow)
    expect(r).toEqual({
      postcode: 'SW11 6QT',
      postcode_district: 'SW11',
      price: 450000,
      date_of_transfer: '2024-06-01 00:00',
      property_type: 'D',
      new_build: false,
    })
  })

  it('returns null when postcode is missing', () => {
    const row = [...validRow]
    row[3] = ''
    expect(parseLandRegistryRow(row)).toBeNull()
  })

  it('returns null for invalid property_type', () => {
    const row = [...validRow]
    row[4] = 'X'
    expect(parseLandRegistryRow(row)).toBeNull()
  })

  it('derives postcode_district correctly', () => {
    expect(extractDistrict('SW11 6QT')).toBe('SW11')
    expect(extractDistrict('  e1 6an ')).toBe('E1')
  })

  it('parses new_build Y as true', () => {
    const row = [...validRow]
    row[5] = 'Y'
    expect(parseLandRegistryRow(row).new_build).toBe(true)
  })

  it('returns null for invalid price', () => {
    const row = [...validRow]
    row[1] = 'abc'
    expect(parseLandRegistryRow(row)).toBeNull()
  })
})
