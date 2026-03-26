import { describe, it, expect } from 'vitest'
import { assembleSanitizedSkill, serializeScanResultBindings } from '../src/index'
import type { QueueMessage, QueueMessageMetadata } from '../src/types'

/* ── assembleSanitizedSkill ───────────────────────────────────── */

describe('assembleSanitizedSkill', () => {
  const baseJob: QueueMessage = {
    id: 'job-1',
    originalText: 'Expert in React and TypeScript',
    sourceType: 'text',
    status: 'processing',
    stage: 3,
    timestamp: Date.now(),
  }

  it('populates all fields from full metadata', () => {
    const metadata: QueueMessageMetadata = {
      sanitizedText: 'Clean text',
      detectedUrls: ['https://a.com'],
      normalizedUrls: ['https://a.com/'],
      shellCommands: ['npm install'],
      injections: ['/eval\\(/i'],
      tags: ['programming', 'nodejs'],
      riskLevel: 'high',
      summary: 'A risky skill.',
    }
    const skill = assembleSanitizedSkill(baseJob, metadata)

    expect(skill.sanitizedText).toBe('Clean text')
    expect(skill.urls).toEqual(['https://a.com'])
    expect(skill.shellCommands).toEqual(['npm install'])
    expect(skill.injections).toEqual(['/eval\\(/i'])
    expect(skill.tags).toEqual(['programming', 'nodejs'])
    expect(skill.riskLevel).toBe('high')
    expect(skill.tldr).toBe('A risky skill.')
    expect(skill.metadata?.normalizedUrls).toEqual(['https://a.com/'])
    expect(skill.metadata?.detectedUrls).toEqual(['https://a.com'])
  })

  it('falls back to defaults when metadata is empty', () => {
    const skill = assembleSanitizedSkill(baseJob, {})

    expect(skill.tags).toEqual(['uncategorized'])
    expect(skill.riskLevel).toBe('medium')
    expect(skill.tldr).toBe('AI Agent skill set requiring review.')
    expect(skill.urls).toEqual([])
    expect(skill.shellCommands).toEqual([])
    expect(skill.injections).toEqual([])
  })

  it('falls back sanitizedText to originalText when missing', () => {
    const skill = assembleSanitizedSkill(baseJob, {})
    expect(skill.sanitizedText).toBe(baseJob.originalText)
  })

  it('includes url and sourceType in nested metadata for URL jobs', () => {
    const urlJob: QueueMessage = {
      ...baseJob,
      sourceType: 'url',
      url: 'https://example.com/skill.md',
    }
    const skill = assembleSanitizedSkill(urlJob, {})

    expect(skill.metadata?.sourceType).toBe('url')
    expect(skill.metadata?.url).toBe('https://example.com/skill.md')
  })

  it('always includes processedBy and stage in nested metadata', () => {
    const skill = assembleSanitizedSkill(baseJob, {})
    expect(skill.metadata?.processedBy).toBe('worker3')
    expect(skill.metadata?.stage).toBe(3)
  })
})

/* ── serializeScanResultBindings ──────────────────────────────── */

describe('serializeScanResultBindings', () => {
  const skill = assembleSanitizedSkill(
    {
      id: 'job-42',
      originalText: 'some text',
      sourceType: 'text',
      status: 'processing',
      stage: 3,
      timestamp: Date.now(),
    },
    {
      sanitizedText: 'clean text',
      detectedUrls: ['https://a.com'],
      shellCommands: ['curl x'],
      injections: [],
      tags: ['programming'],
      riskLevel: 'low',
      summary: 'A safe skill.',
    },
  )

  it('produces a 10-element tuple', () => {
    const bindings = serializeScanResultBindings('job-42', skill)
    expect(bindings).toHaveLength(10)
  })

  it('places jobId as both id and job_id (indices 0 and 1)', () => {
    const bindings = serializeScanResultBindings('job-42', skill)
    expect(bindings[0]).toBe('job-42')
    expect(bindings[1]).toBe('job-42')
  })

  it('JSON-stringifies array fields', () => {
    const bindings = serializeScanResultBindings('job-42', skill)
    expect(bindings[3]).toBe(JSON.stringify(skill.urls))
    expect(bindings[4]).toBe(JSON.stringify(skill.shellCommands))
    expect(bindings[5]).toBe(JSON.stringify(skill.injections))
    expect(bindings[6]).toBe(JSON.stringify(skill.tags))
  })

  it('serializes missing tldr as empty string', () => {
    const noTldr = { ...skill, tldr: undefined }
    const bindings = serializeScanResultBindings('job-x', noTldr)
    expect(bindings[8]).toBe('')
  })

  it('JSON-stringifies the metadata object', () => {
    const bindings = serializeScanResultBindings('job-42', skill)
    const parsed = JSON.parse(bindings[9])
    expect(parsed.processedBy).toBe('worker3')
    expect(parsed.stage).toBe(3)
  })
})
