import { describe, it, expect } from 'vitest'
import { jsonLdScript } from '@/lib/schema'

describe('jsonLdScript', () => {
  it('serializes plain objects', () => {
    expect(jsonLdScript({ name: 'Sunny Days Nursery' })).toBe('{"name":"Sunny Days Nursery"}')
  })

  it('escapes < so a value cannot close the script tag (XSS guard)', () => {
    const out = jsonLdScript({ name: 'Evil</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c/script>')
    // Still valid JSON that parses back to the original string
    expect(JSON.parse(out).name).toBe('Evil</script><script>alert(1)</script>')
  })
})
