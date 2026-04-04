import { describe, it, expect } from 'vitest'
import {
  parseJsonField,
  normalizedUrlsFromMetadata,
  buildTextQueueMessage,
  buildUrlQueueMessage,
  buildJobInsertBindings,
  formatScanResultResponse,
  formatJobProgressResponse,
} from '../../src/index'
import {
  computePendingUrlJobInputHash,
  computePendingTextJobInputHash,
  computeInputHash,
  isSkillScanDedupEnabled,
} from '../../src/utils'
import { AppError } from '../../src/app-error'
import { PROGRESS_QUEUED, progressPhaseFromValue, resolveJobProgressPercent } from '../../src/job-progress'

/* ── parseJsonField ───────────────────────────────────────────── */

describe('parseJsonField', () => {
  it('parses a valid JSON string', () => {
    expect(parseJsonField('["a","b"]', [])).toEqual(['a', 'b'])
  })

  it('returns fallback for invalid JSON', () => {
    expect(parseJsonField('not-json', 'default')).toBe('default')
  })

  it('returns fallback for null', () => {
    expect(parseJsonField(null, 42)).toBe(42)
  })

  it('returns fallback for empty string', () => {
    expect(parseJsonField('', [])).toEqual([])
  })

  it('passes through non-string values', () => {
    const obj = { key: 'value' }
    expect(parseJsonField(obj, {})).toBe(obj)
  })
})

/* ── normalizedUrlsFromMetadata ───────────────────────────────── */

describe('normalizedUrlsFromMetadata', () => {
  it('extracts normalizedUrls from JSON metadata string', () => {
    const meta = JSON.stringify({ normalizedUrls: ['https://a.com/', 'https://b.com/'] })
    expect(normalizedUrlsFromMetadata(meta)).toEqual(['https://a.com/', 'https://b.com/'])
  })

  it('returns empty array when normalizedUrls is missing', () => {
    expect(normalizedUrlsFromMetadata(JSON.stringify({}))).toEqual([])
  })

  it('filters out non-string entries', () => {
    const meta = JSON.stringify({ normalizedUrls: ['https://a.com', 42, null, 'https://b.com'] })
    expect(normalizedUrlsFromMetadata(meta)).toEqual(['https://a.com', 'https://b.com'])
  })

  it('handles null/undefined input', () => {
    expect(normalizedUrlsFromMetadata(null)).toEqual([])
    expect(normalizedUrlsFromMetadata(undefined)).toEqual([])
  })

  it('handles non-JSON string input gracefully', () => {
    expect(normalizedUrlsFromMetadata('not-json')).toEqual([])
  })
})

/* ── computePendingUrlJobInputHash ────────────────────────────── */

describe('computePendingUrlJobInputHash', () => {
  it('returns correct prefix format', () => {
    expect(computePendingUrlJobInputHash('abc-123')).toBe('pending-url:abc-123')
  })

  it('produces different hashes for different jobIds', () => {
    const a = computePendingUrlJobInputHash('id-1')
    const b = computePendingUrlJobInputHash('id-2')
    expect(a).not.toBe(b)
  })
})

/* ── computePendingTextJobInputHash ───────────────────────────── */

describe('computePendingTextJobInputHash', () => {
  it('returns correct prefix format', () => {
    expect(computePendingTextJobInputHash('abc-123')).toBe('pending-text:abc-123')
  })

  it('produces different hashes for different jobIds', () => {
    const a = computePendingTextJobInputHash('id-1')
    const b = computePendingTextJobInputHash('id-2')
    expect(a).not.toBe(b)
  })
})

/* ── isSkillScanDedupEnabled ──────────────────────────────────── */

describe('isSkillScanDedupEnabled', () => {
  it('is true when unset', () => {
    expect(isSkillScanDedupEnabled(undefined)).toBe(true)
  })

  it('is false only for the string false', () => {
    expect(isSkillScanDedupEnabled('false')).toBe(false)
    expect(isSkillScanDedupEnabled('true')).toBe(true)
    expect(isSkillScanDedupEnabled('')).toBe(true)
  })
})

/* ── computeInputHash ─────────────────────────────────────────── */

describe('computeInputHash', () => {
  it('is deterministic for the same input', async () => {
    const h1 = await computeInputHash('hello world')
    const h2 = await computeInputHash('hello world')
    expect(h1).toBe(h2)
  })

  it('produces different hashes for different inputs', async () => {
    const h1 = await computeInputHash('input one')
    const h2 = await computeInputHash('input two')
    expect(h1).not.toBe(h2)
  })

  it('trims and lowercases before hashing', async () => {
    const h1 = await computeInputHash('  Hello World  ')
    const h2 = await computeInputHash('hello world')
    expect(h1).toBe(h2)
  })
})

/* ── buildTextQueueMessage ────────────────────────────────────── */

describe('buildTextQueueMessage', () => {
  it('produces correct structure', () => {
    const msg = buildTextQueueMessage('job-1', 'skill text', 'hash-abc', {
      sourceType: 'text',
      userId: 'user-1',
    })
    expect(msg.id).toBe('job-1')
    expect(msg.originalText).toBe('skill text')
    expect(msg.inputHash).toBe('hash-abc')
    expect(msg.sourceType).toBe('text')
    expect(msg.status).toBe('queued')
    expect(msg.stage).toBe(1)
  })

  it('handles optional userId as undefined', () => {
    const msg = buildTextQueueMessage('job-2', 'text', 'hash', {
      sourceType: 'text',
    })
    expect(msg.userId).toBeUndefined()
  })

  it('includes url when provided in input', () => {
    const msg = buildTextQueueMessage('job-3', 'text', 'hash', {
      sourceType: 'text',
      url: 'https://example.com',
    })
    expect(msg.url).toBe('https://example.com')
  })
})

/* ── buildUrlQueueMessage ─────────────────────────────────────── */

describe('buildUrlQueueMessage', () => {
  it('produces correct structure with empty originalText', () => {
    const msg = buildUrlQueueMessage('job-1', 'pending-url:job-1', 'https://example.com', 'user-1')
    expect(msg.originalText).toBe('')
    expect(msg.sourceType).toBe('url')
    expect(msg.url).toBe('https://example.com')
    expect(msg.inputHash).toBe('pending-url:job-1')
    expect(msg.status).toBe('queued')
    expect(msg.stage).toBe(1)
  })

  it('handles missing userId', () => {
    const msg = buildUrlQueueMessage('job-2', 'hash', 'https://a.com')
    expect(msg.userId).toBeUndefined()
  })
})

/* ── buildJobInsertBindings ───────────────────────────────────── */

describe('buildJobInsertBindings', () => {
  it('produces a 9-element tuple', () => {
    const bindings = buildJobInsertBindings('j1', 'h1', 'content', 'text', null, null)
    expect(bindings).toHaveLength(9)
  })

  it('handles null url and userId', () => {
    const bindings = buildJobInsertBindings('j1', 'h1', '', 'url', null, null)
    expect(bindings[4]).toBeNull()
    expect(bindings[5]).toBeNull()
  })

  it('matches INSERT column order including progress', () => {
    const bindings = buildJobInsertBindings('j1', 'hash', 'text', 'text', 'https://a.com', 'u1')
    expect(bindings).toEqual([
      'j1',
      'hash',
      'text',
      'text',
      'https://a.com',
      'u1',
      'queued',
      1,
      PROGRESS_QUEUED,
    ])
  })
})

/* ── formatScanResultResponse ─────────────────────────────────── */

describe('formatScanResultResponse', () => {
  const job = {
    status: 'completed',
    url: 'https://example.com/skill.md',
    original_text: 'Expert in React',
  }

  const result = {
    sanitized_text: 'Clean text',
    urls: JSON.stringify(['https://a.com']),
    shell_commands: JSON.stringify(['npm install']),
    injections: JSON.stringify([]),
    tags: JSON.stringify(['programming']),
    risk_level: 'low',
    tldr: 'A safe skill.',
    metadata: JSON.stringify({ normalizedUrls: ['https://a.com/'] }),
  }

  it('parses JSON fields from result', () => {
    const resp = formatScanResultResponse('id-1', job, result)
    expect(resp.result.urls).toEqual(['https://a.com'])
    expect(resp.result.shellCommands).toEqual(['npm install'])
    expect(resp.result.tags).toEqual(['programming'])
  })

  it('extracts normalizedUrls from metadata', () => {
    const resp = formatScanResultResponse('id-1', job, result)
    expect(resp.result.normalizedUrls).toEqual(['https://a.com/'])
  })

  it('includes sourceUrl when present in job', () => {
    const resp = formatScanResultResponse('id-1', job, result)
    expect(resp.sourceUrl).toBe('https://example.com/skill.md')
    expect(resp.originalSkillMarkdown).toBe('Expert in React')
  })

  it('omits sourceUrl when job.url is empty', () => {
    const noUrlJob = { ...job, url: '' }
    const resp = formatScanResultResponse('id-1', noUrlJob, result)
    expect(resp.sourceUrl).toBeUndefined()
  })

  it('always sets progress to 100', () => {
    const resp = formatScanResultResponse('id-1', job, result)
    expect(resp.progress).toBe(100)
  })

  it('includes progressPhase Complete', () => {
    const resp = formatScanResultResponse('id-1', job, result)
    expect(resp.progressPhase).toBe('Complete')
  })
})

/* ── formatJobProgressResponse ────────────────────────────────── */

describe('formatJobProgressResponse', () => {
  it('computes progress from stage number when progress column absent', () => {
    const resp = formatJobProgressResponse('id-1', { stage: 2, status: 'processing' })
    expect(resp.progress).toBe(66)
  })

  it('prefers jobs.progress over stage when present', () => {
    const resp = formatJobProgressResponse('id-1', {
      stage: 1,
      progress: 58,
      status: 'processing',
    })
    expect(resp.progress).toBe(58)
    expect(resp.progressPhase).toBe('Classifying with AI…')
  })

  it('caps in-flight progress at 99', () => {
    const resp = formatJobProgressResponse('id-1', {
      progress: 150,
      status: 'processing',
    })
    expect(resp.progress).toBe(99)
  })

  it('defaults to 33 progress for missing/zero stage', () => {
    const resp = formatJobProgressResponse('id-1', { status: 'processing' })
    expect(resp.progress).toBe(33)
  })

  it('includes sourceUrl and originalSkillMarkdown when present', () => {
    const resp = formatJobProgressResponse('id-1', {
      status: 'processing',
      stage: 1,
      url: 'https://example.com',
      original_text: 'Some markdown',
    })
    expect(resp.sourceUrl).toBe('https://example.com')
    expect(resp.originalSkillMarkdown).toBe('Some markdown')
  })

  it('omits sourceUrl when url is empty string', () => {
    const resp = formatJobProgressResponse('id-1', { status: 'processing', url: '' })
    expect(resp.sourceUrl).toBeUndefined()
  })

  it('defaults status to processing when missing', () => {
    const resp = formatJobProgressResponse('id-1', {})
    expect(resp.status).toBe('processing')
  })

  it('uses Scan failed phase when status is failed', () => {
    const resp = formatJobProgressResponse('id-1', { status: 'failed', progress: 0 })
    expect(resp.progressPhase).toBe('Scan failed')
  })
})

/* ── resolveJobProgressPercent / progressPhaseFromValue ───────── */

describe('resolveJobProgressPercent', () => {
  it('returns 100 for completed status', () => {
    expect(resolveJobProgressPercent({ status: 'completed', progress: 42 })).toBe(100)
  })
})

describe('progressPhaseFromValue', () => {
  it('labels queued band', () => {
    expect(progressPhaseFromValue(7)).toBe('Queued…')
  })
})

/* ── AppError ─────────────────────────────────────────────────── */

describe('AppError', () => {
  it('defaults to status 500', () => {
    const err = new AppError('something broke')
    expect(err.status).toBe(500)
    expect(err.message).toBe('something broke')
    expect(err.name).toBe('AppError')
  })

  it('accepts custom status', () => {
    const err = new AppError('not found', { status: 404 })
    expect(err.status).toBe(404)
  })

  it('stores code property', () => {
    const err = new AppError('bad', { code: 'VALIDATION_ERROR' })
    expect(err.code).toBe('VALIDATION_ERROR')
  })

  it('chains cause', () => {
    const cause = new Error('root cause')
    const err = new AppError('wrapper', { cause })
    expect(err.cause).toBe(cause)
  })
})
