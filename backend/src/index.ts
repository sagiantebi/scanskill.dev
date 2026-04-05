import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { QueueMessage, Job } from './types'
import {
  computeInputHash,
  findJobByHash,
  computePendingUrlJobInputHash,
  computePendingTextJobInputHash,
  findCompletedJobBySourceUrl,
  isSkillScanDedupEnabled,
} from './utils'
import { AppError } from './app-error'
import {
  PROGRESS_QUEUED,
  progressPhaseFromValue,
  resolveJobProgressPercent,
} from './job-progress'

export type SkillsScannerBindings = {
  DB: D1Database
  SKILLS_QUEUE_1: Queue
  /** Set to the string "false" to disable API-level deduplication (new job per submit). */
  SKILL_SCAN_DEDUP_ENABLED?: string
}

const app = new Hono<{ Bindings: SkillsScannerBindings }>()

export function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }
  return raw as T
}

export function normalizedUrlsFromMetadata(raw: unknown): string[] {
  const meta = parseJsonField<Record<string, unknown>>(raw, {})
  const nu = meta.normalizedUrls
  if (!Array.isArray(nu)) return []
  return nu.filter((x): x is string => typeof x === 'string')
}

export function buildTextQueueMessage(
  jobId: string,
  content: string,
  inputHash: string,
  input: { sourceType: 'text' | 'url'; url?: string; userId?: string },
  apiDedupEnabled = true,
): QueueMessage {
  return {
    id: jobId,
    inputHash,
    originalText: content,
    sourceType: input.sourceType,
    url: input.url,
    userId: input.userId,
    apiDedupEnabled,
    status: 'queued',
    stage: 1,
    timestamp: Date.now(),
  }
}

export function buildUrlQueueMessage(
  jobId: string,
  pendingHash: string,
  sourceUrl: string,
  userId?: string,
  apiDedupEnabled = true,
): QueueMessage {
  return {
    id: jobId,
    inputHash: pendingHash,
    originalText: '',
    sourceType: 'url',
    url: sourceUrl,
    userId,
    apiDedupEnabled,
    status: 'queued',
    stage: 1,
    timestamp: Date.now(),
  }
}

export function buildJobInsertBindings(
  jobId: string,
  inputHash: string,
  content: string,
  sourceType: 'text' | 'url',
  url: string | null,
  userId: string | null,
): [string, string, string, string, string | null, string | null, string, number, number] {
  return [jobId, inputHash, content, sourceType, url, userId, 'queued', 1, PROGRESS_QUEUED]
}

export function formatScanResultResponse(
  id: string,
  job: Record<string, unknown>,
  result: Record<string, unknown>,
) {
  const sourceUrl =
    typeof job.url === 'string' && job.url.length > 0 ? job.url : undefined
  const originalSkillMarkdown =
    typeof job.original_text === 'string' && job.original_text.length > 0
      ? job.original_text
      : undefined

  const normalizedUrls = normalizedUrlsFromMetadata(result.metadata)
  return {
    id,
    status: job.status,
    progress: 100,
    progressPhase: 'Complete',
    sourceUrl,
    originalSkillMarkdown,
    result: {
      sanitizedText: result.sanitized_text,
      urls: parseJsonField<string[]>(result.urls, []),
      normalizedUrls,
      shellCommands: parseJsonField<string[]>(result.shell_commands, []),
      injections: parseJsonField<string[]>(result.injections, []),
      tags: parseJsonField<string[]>(result.tags, []),
      riskLevel: result.risk_level,
      tldr: result.tldr,
    },
  }
}

export function formatJobProgressResponse(
  id: string,
  job: Record<string, unknown>,
) {
  const sourceUrl =
    typeof job.url === 'string' && job.url.length > 0 ? job.url : undefined
  const originalSkillMarkdown =
    typeof job.original_text === 'string' && job.original_text.length > 0
      ? job.original_text
      : undefined

  const statusStr =
    typeof job.status === 'string' && job.status.length > 0
      ? job.status
      : 'processing'
  const progress = resolveJobProgressPercent(job)
  const progressPhase =
    statusStr === 'failed'
      ? 'Scan failed'
      : progressPhaseFromValue(progress)

  return {
    id,
    status: statusStr,
    progress,
    progressPhase,
    stage: job.stage,
    sourceUrl,
    originalSkillMarkdown,
  }
}

export const SkillInputSchema = z
  .object({
    content: z.string().optional(),
    sourceType: z.enum(['text', 'url']).default('text'),
    url: z.string().url().optional(),
    userId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === 'text') {
      const c = data.content?.trim() ?? ''
      if (c.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Skill content must be at least 10 characters',
          path: ['content'],
        })
      }
    }
    if (data.sourceType === 'url') {
      const u = data.url?.trim()
      if (!u) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'URL is required when sourceType is url',
          path: ['url'],
        })
      }
    }
  })

type SkillInput = z.infer<typeof SkillInputSchema>

// POST /api/skills - Submit skill for scanning and sanitization (v0)
// Performs early deduplication using SHA-256 hash of normalized input
app.post('/api/skills', zValidator('json', SkillInputSchema), async (c) => {
  const input = c.req.valid('json')
  const dedupEnabled = isSkillScanDedupEnabled(c.env.SKILL_SCAN_DEDUP_ENABLED)

  try {
    if (input.sourceType === 'url') {
      const sourceUrl = input.url!.trim()
      if (dedupEnabled) {
        const cachedByUrl = await findCompletedJobBySourceUrl(c.env.DB, sourceUrl)
        if (cachedByUrl) {
          return c.json({
            success: true,
            message: 'Skill already scanned for this URL - returning cached result',
            jobId: cachedByUrl.id,
            status: cachedByUrl.status,
            cached: true,
          })
        }
      }

      const jobId = crypto.randomUUID()
      const pendingHash = computePendingUrlJobInputHash(jobId)
      const bindings = buildJobInsertBindings(jobId, pendingHash, '', 'url', sourceUrl, input.userId || null)

      await c.env.DB.prepare(
        `INSERT INTO jobs (id, input_hash, original_text, source_type, url, user_id, status, stage, progress)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(...bindings).run()

      await c.env.SKILLS_QUEUE_1.send(
        buildUrlQueueMessage(jobId, pendingHash, sourceUrl, input.userId, dedupEnabled),
      )

      return c.json({
        success: true,
        message: 'Skill submitted for scanning and sanitization',
        jobId,
        status: 'queued',
      })
    }

    const content = input.content!.trim()
    const contentHash = await computeInputHash(content)

    if (dedupEnabled) {
      const existing = await findJobByHash(c.env.DB, contentHash)
      if (existing) {
        return c.json({
          success: true,
          message: 'Skill already scanned - returning cached result',
          jobId: existing.id,
          status: existing.status,
          cached: true,
        })
      }
    }

    const jobId = crypto.randomUUID()
    const rowHash = dedupEnabled ? contentHash : computePendingTextJobInputHash(jobId)
    const bindings = buildJobInsertBindings(jobId, rowHash, content, input.sourceType, input.url?.trim() || null, input.userId || null)

    await c.env.DB.prepare(
      `INSERT INTO jobs (id, input_hash, original_text, source_type, url, user_id, status, stage, progress)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(...bindings).run()

    await c.env.SKILLS_QUEUE_1.send(buildTextQueueMessage(jobId, content, rowHash, input, dedupEnabled))

    return c.json({ 
      success: true, 
      message: 'Skill submitted for scanning and sanitization',
      jobId,
      status: 'queued'
    })
  } catch (error) {
    console.error('Failed to enqueue skill:', error)
    if (error instanceof AppError) {
      return c.json(
        { success: false, error: error.message, code: error.code },
        error.status,
      )
    }
    return c.json({ success: false, error: 'Failed to submit skill' }, 500)
  }
})

// GET /api/stats - Count of completed scans persisted in D1
app.get('/api/stats', async (c) => {
  try {
    const row = await c.env.DB.prepare(
      'SELECT COUNT(*) AS n FROM scan_results'
    ).first<{ n: number }>()
    const n = row?.n ?? 0
    return c.json({ completedScans: Number(n) })
  } catch (error) {
    console.error('Failed to read stats:', error)
    return c.json({ completedScans: 0 })
  }
})

// GET /api/tags - Distinct tags with usage counts from scan_results.tags JSON arrays
app.get('/api/tags', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT e.value AS tag, COUNT(*) AS cnt
       FROM scan_results s, json_each(s.tags) AS e
       WHERE s.tags IS NOT NULL
         AND TRIM(CAST(s.tags AS TEXT)) != ''
         AND CAST(s.tags AS TEXT) != 'null'
       GROUP BY e.value
       ORDER BY cnt DESC, tag ASC`
    ).all<{ tag: string; cnt: number }>()

    return c.json({
      tags: (results ?? []).map((r) => ({
        tag: r.tag,
        count: Number(r.cnt),
      })),
    })
  } catch (error) {
    console.error('Failed to list tags:', error)
    return c.json({ tags: [] as { tag: string; count: number }[] })
  }
})

// GET /api/skills/by-tag/:tag - Browse completed scans that include a tag (must be before /api/skills/:id)
app.get('/api/skills/by-tag/:tag', async (c) => {
  const tag = decodeURIComponent(c.req.param('tag'))

  try {
    const { results } = await c.env.DB.prepare(
      `SELECT s.id AS id, s.tldr AS tldr, s.risk_level AS risk_level, j.original_text AS original_text
       FROM scan_results s
       INNER JOIN jobs j ON j.id = s.id
       WHERE EXISTS (
         SELECT 1 FROM json_each(s.tags) AS e WHERE e.value = ?
       )
       ORDER BY s.created_at DESC
       LIMIT 50`
    )
      .bind(tag)
      .all<{
        id: string
        tldr: string | null
        risk_level: string | null
        original_text: string
      }>()

    return c.json({
      tag,
      skills: (results ?? []).map((r) => ({
        id: r.id,
        tldr: r.tldr,
        riskLevel: r.risk_level,
        preview:
          r.original_text.length > 160
            ? `${r.original_text.slice(0, 160)}…`
            : r.original_text,
      })),
    })
  } catch (error) {
    console.error('Failed to list skills by tag:', error)
    return c.json({ tag, skills: [] })
  }
})

// GET /api/skills/:id - Get skill scan status and results
app.get('/api/skills/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    // Check jobs table
    const job = await c.env.DB.prepare('SELECT * FROM jobs WHERE id = ?')
      .bind(id)
      .first()
    
    if (!job) {
      return c.json({ error: 'Job not found' }, 404)
    }

    const result = await c.env.DB.prepare('SELECT * FROM scan_results WHERE id = ?')
      .bind(id)
      .first()

    const jobRec = job as Record<string, unknown>

    if (result) {
      return c.json(formatScanResultResponse(id, jobRec, result as Record<string, unknown>))
    }

    return c.json(formatJobProgressResponse(id, jobRec))
  } catch (error) {
    console.error('Failed to fetch job status:', error)
    return c.json({
      id,
      status: 'processing',
      progress: 33,
      progressPhase: progressPhaseFromValue(33),
    })
  }
})

export default app

export type { Job }
