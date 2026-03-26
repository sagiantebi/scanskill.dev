import { describe, expect, it } from 'vitest'
import { SkillInputSchema } from '../src/index'

describe('SkillInputSchema', () => {
  it('accepts valid text skill', () => {
    const parsed = SkillInputSchema.safeParse({
      content:
        'Expert in React, TypeScript, and Cloudflare Workers for backend APIs.',
      sourceType: 'text',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects short text content', () => {
    const parsed = SkillInputSchema.safeParse({
      content: 'short',
      sourceType: 'text',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts url source with https URL', () => {
    const parsed = SkillInputSchema.safeParse({
      sourceType: 'url',
      url: 'https://example.com/skills/sample.md',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects url source without url', () => {
    const parsed = SkillInputSchema.safeParse({
      sourceType: 'url',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts optional userId on text submission', () => {
    const parsed = SkillInputSchema.safeParse({
      content:
        'Expert in React, TypeScript, and Cloudflare Workers for backend APIs.',
      sourceType: 'text',
      userId: 'user-123',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.userId).toBe('user-123')
    }
  })
})
