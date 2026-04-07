import { describe, it, expect } from 'vitest'
import { parseListing } from '../src/services/propertyDataListings.js'

const saleRaw = {
  id: 'pd-12345',
  address: '12 Acacia Avenue, London',
  postcode: 'SW11 1AA',
  price: '£725,000',
  bedrooms: 3,
  bathrooms: 2,
  property_type: 'Terraced',
  description: 'Lovely period home',
  image_url: 'https://img.example/12.jpg',
  url: 'https://agent.example/12345',
  agent_name: 'Acme Estates',
  latitude: 51.4671,
  longitude: -0.1655,
}

const rentRaw = {
  listing_id: 'r-9',
  display_address: '4 Park Lane',
  postcode: 'SW11 2BB',
  rent_pw: 575,
  beds: 2,
  baths: 1,
  type: 'Flat',
  images: ['https://img.example/r9-a.jpg', 'https://img.example/r9-b.jpg'],
  link: 'https://agent.example/r9',
  branch_name: 'Foo Lettings',
  lat: 51.46,
  lon: -0.17,
}

describe('parseListing', () => {
  it('parses a sale listing into a normalized row', () => {
    const row = parseListing(saleRaw, 'sale', 'SW11')
    expect(row.postcode_district).toBe('SW11')
    expect(row.listing_type).toBe('sale')
    expect(row.external_id).toBe('pd-12345')
    expect(row.price).toBe(725000)
    expect(row.bedrooms).toBe(3)
    expect(row.bathrooms).toBe(2)
    expect(row.property_type).toBe('Terraced')
    expect(row.image_url).toBe('https://img.example/12.jpg')
    expect(row.listing_url).toBe('https://agent.example/12345')
    expect(row.agent_name).toBe('Acme Estates')
    expect(row.lat).toBeCloseTo(51.4671)
    expect(row.lng).toBeCloseTo(-0.1655)
  })

  it('parses a rent listing with alternate field names and image array', () => {
    const row = parseListing(rentRaw, 'rent', 'SW11')
    expect(row.listing_type).toBe('rent')
    expect(row.external_id).toBe('r-9')
    expect(row.address).toBe('4 Park Lane')
    expect(row.price).toBe(575)
    expect(row.bedrooms).toBe(2)
    expect(row.property_type).toBe('Flat')
    expect(row.image_url).toBe('https://img.example/r9-a.jpg')
    expect(row.agent_name).toBe('Foo Lettings')
    expect(row.lng).toBeCloseTo(-0.17)
  })

  it('returns nulls (not crashes) for missing fields', () => {
    const row = parseListing({}, 'sale', 'SW11')
    expect(row).not.toBeNull()
    expect(row.external_id).toBeNull()
    expect(row.price).toBeNull()
    expect(row.bedrooms).toBeNull()
    expect(row.image_url).toBeNull()
    expect(row.lat).toBeNull()
    expect(row.lng).toBeNull()
  })

  it('returns null when raw is null or not an object', () => {
    expect(parseListing(null, 'sale', 'SW11')).toBeNull()
    expect(parseListing(undefined, 'sale', 'SW11')).toBeNull()
    expect(parseListing('nope', 'sale', 'SW11')).toBeNull()
  })

  it('strips currency symbols and commas from price', () => {
    const row = parseListing({ price: '£1,250,000' }, 'sale', 'NW3')
    expect(row.price).toBe(1250000)
  })
})
