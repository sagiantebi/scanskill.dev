import { describe, it, expect, beforeAll } from 'vitest'
import { SELF, env } from 'cloudflare:test'
import { D1_TEST_STATEMENTS } from './d1-schema'

describe('Skills Scanner Backend', () => {
  beforeAll(async () => {
    for (const sql of D1_TEST_STATEMENTS) {
      await env.DB.prepare(sql).run()
    }
  })

  it('accepts a valid skill submission', async () => {
    const res = await SELF.fetch('http://localhost/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content:
          'Expert in React, TypeScript, and Cloudflare Workers for backend APIs.',
        sourceType: 'text',
      }),
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      success: boolean
      jobId?: string
    }
    expect(data.success).toBe(true)
    expect(data.jobId).toBeDefined()
  })

  it('rejects invalid skill payload', async () => {
    const res = await SELF.fetch('http://localhost/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'short',
      }),
    })

    expect(res.status).toBe(400)
  })

  it('accepts URL-only skill submission', async () => {
    const res = await SELF.fetch('http://localhost/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: 'url',
        url: 'https://example.com/skills/sample.md',
      }),
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      success: boolean
      jobId?: string
      cached?: boolean
    }
    expect(data.success).toBe(true)
    expect(data.jobId).toBeDefined()
  })

  it('rejects url sourceType without url', async () => {
    const res = await SELF.fetch('http://localhost/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: 'url',
      }),
    })

    expect(res.status).toBe(400)
  })

  it('GET /api/stats returns completedScans', async () => {
    const res = await SELF.fetch('http://localhost/api/stats')
    expect(res.status).toBe(200)
    const data = (await res.json()) as { completedScans: number }
    expect(typeof data.completedScans).toBe('number')
    expect(data.completedScans).toBeGreaterThanOrEqual(0)
  })

  it('GET /api/tags returns tags array', async () => {
    const res = await SELF.fetch('http://localhost/api/tags')
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      tags: { tag: string; count: number }[]
    }
    expect(Array.isArray(data.tags)).toBe(true)
  })
})
