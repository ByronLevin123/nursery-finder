// Generates sitemap.xml with all nursery and area URLs
// Run: node scripts/generate-sitemap.js
// Schedule: weekly in worker.js cron

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const BASE_URL = process.env.FRONTEND_URL || 'https://nurserymatch.com'

async function generateSitemap() {
  console.log('Generating sitemap...')

  // Fetch all active URNs
  const { data: nurseries } = await db
    .from('nurseries')
    .select('urn, updated_at')
    .eq('registration_status', 'Active')
    .limit(100000)

  // Fetch all postcode districts
  const { data: areas } = await db
    .from('postcode_areas')
    .select('postcode_district, updated_at')

  const urls = [
    // Static pages
    `<url><loc>${BASE_URL}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${BASE_URL}/search</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    `<url><loc>${BASE_URL}/privacy</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>`,

    // Nursery pages
    ...(nurseries || []).map(n =>
      `<url><loc>${BASE_URL}/nursery/${n.urn}</loc><lastmod>${n.updated_at?.split('T')[0]}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`
    ),

    // Area pages
    ...(areas || []).map(a =>
      `<url><loc>${BASE_URL}/nurseries-in/${a.postcode_district.toLowerCase()}</loc><lastmod>${a.updated_at?.split('T')[0]}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`
    ),
  ]

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  writeFileSync('frontend/public/sitemap.xml', sitemap)
  console.log(`✅ Sitemap generated: ${urls.length} URLs`)
  console.log(`   ${nurseries?.length || 0} nursery pages`)
  console.log(`   ${areas?.length || 0} area pages`)
}

generateSitemap().catch(console.error)
