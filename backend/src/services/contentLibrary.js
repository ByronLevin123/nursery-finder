// Content library — reads the guide/blog markdown so automation (content
// syndication) can reference real articles. Self-contained on purpose so it
// never couples to the public blog route.

import fs from 'fs'
import path from 'path'
import { logger } from '../logger.js'

const BLOG_DIR = fs.existsSync(path.resolve(process.cwd(), 'content', 'blog'))
  ? path.resolve(process.cwd(), 'content', 'blog')
  : path.resolve(process.cwd(), '..', 'content', 'blog')

export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: content }
  const meta = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    meta[key] = value
  }
  return { meta, body: match[2].trim() }
}

// Return guide metadata (no body), newest first. Never throws.
export function loadGuides(dir = BLOG_DIR) {
  try {
    if (!fs.existsSync(dir)) {
      logger.warn({ dir }, 'contentLibrary: blog dir not found')
      return []
    }
    const guides = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((file) => {
        const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(dir, file), 'utf-8'))
        return {
          slug: meta.slug || file.replace('.md', ''),
          title: meta.title || file.replace('.md', '').replace(/-/g, ' '),
          excerpt: meta.excerpt || `${body.slice(0, 160)}...`,
          date: meta.date || null,
        }
      })
    guides.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    return guides
  } catch (err) {
    logger.error({ err: err.message }, 'contentLibrary: failed to load guides')
    return []
  }
}

// Deterministic weekly rotation index so a different guide is syndicated each
// week, stable within the same week.
export function weeklyIndex(date = new Date(), count = 1) {
  if (count <= 0) return 0
  const week = Math.floor(date.getTime() / (7 * 86400000))
  return week % count
}

export default { loadGuides, parseFrontmatter, weeklyIndex }
