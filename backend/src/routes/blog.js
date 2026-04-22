import express from 'express'
import fs from 'fs'
import path from 'path'
import { logger } from '../logger.js'

const router = express.Router()

// In-memory cache for blog posts (5 min TTL)
let postsCache = null
let postsCacheTime = 0
const CACHE_TTL = 5 * 60 * 1000

// Look for blog content in multiple locations (backend/content or root/content)
const BLOG_DIR = fs.existsSync(path.resolve(process.cwd(), 'content', 'blog'))
  ? path.resolve(process.cwd(), 'content', 'blog')
  : path.resolve(process.cwd(), '..', 'content', 'blog')

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: content }

  const meta = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let value = line.slice(colonIdx + 1).trim()
    // Strip surrounding quotes
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

function loadPosts() {
  const now = Date.now()
  if (postsCache && now - postsCacheTime < CACHE_TTL) {
    return postsCache
  }

  try {
    if (!fs.existsSync(BLOG_DIR)) {
      logger.warn({ dir: BLOG_DIR }, 'blog content directory not found')
      postsCache = []
      postsCacheTime = now
      return postsCache
    }

    const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'))
    const posts = []

    for (const file of files) {
      const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8')
      const { meta, body } = parseFrontmatter(raw)
      posts.push({
        slug: meta.slug || file.replace('.md', ''),
        title: meta.title || file.replace('.md', '').replace(/-/g, ' '),
        excerpt: meta.excerpt || body.slice(0, 160) + '...',
        date: meta.date || null,
        author: meta.author || 'NurseryMatch Team',
        body,
      })
    }

    // Sort by date descending
    posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    postsCache = posts
    postsCacheTime = now
    logger.info({ count: posts.length }, 'blog posts loaded')
    return postsCache
  } catch (err) {
    logger.error({ err: err.message }, 'failed to load blog posts')
    return postsCache || []
  }
}

// GET /api/v1/blog — list all posts (without body)
router.get('/', (req, res, next) => {
  try {
    const posts = loadPosts()
    const list = posts.map(({ body, ...rest }) => rest)
    res.json({ data: list })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/blog/:slug — single post with full body
router.get('/:slug', (req, res, next) => {
  try {
    const posts = loadPosts()
    const post = posts.find((p) => p.slug === req.params.slug)
    if (!post) {
      return res.status(404).json({ error: 'Blog post not found' })
    }
    res.json(post)
  } catch (err) {
    next(err)
  }
})

export default router
