import { describe, it, expect, beforeAll } from 'vitest'
import { SELF, env } from 'cloudflare:test'
import { D1_TEST_STATEMENTS } from './d1-schema'

describe('API deduplication disabled (SKILL_SCAN_DEDUP_ENABLED=false)', () => {
  beforeAll(async () => {
    expect(env.SKILL_SCAN_DEDUP_ENABLED).toBe('false')
    for (const sql of D1_TEST_STATEMENTS) {
      await env.DB.prepare(sql).run()
    }
  })

  const sampleText =
    'Expert in React, TypeScript, and Cloudflare Workers for backend APIs — dedup off run.'

  it('two identical text submissions get distinct jobIds and are not cached responses', async () => {
    const body = JSON.stringify({ content: sampleText, sourceType: 'text' })

    const res1 = await SELF.fetch('http://localhost/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    const res2 = await SELF.fetch('http://localhost/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)

    const data1 = (await res1.json()) as {
      success: boolean
      jobId?: string
      cached?: boolean
    }
    const data2 = (await res2.json()) as {
      success: boolean
      jobId?: string
      cached?: boolean
    }

    expect(data1.success).toBe(true)
    expect(data2.success).toBe(true)
    expect(data1.jobId).toBeDefined()
    expect(data2.jobId).toBeDefined()
    expect(data1.jobId).not.toBe(data2.jobId)
    expect(data1.cached).not.toBe(true)
    expect(data2.cached).not.toBe(true)
  })
})
