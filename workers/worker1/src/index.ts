/// <reference types="@cloudflare/workers-types" />
import type { QueueMessage } from './types'
import { extractUrls } from './types'
import type { QueueMessageMetadata } from '../../../backend/src/types'
import { computeInputHash } from '../../../backend/src/utils'

export interface Env {
  SKILLS_QUEUE_1: Queue
  SKILLS_QUEUE_2: Queue
  DB: D1Database
}

const MAX_DECODE_PASSES = 2
const MAX_FETCH_BYTES = 2 * 1024 * 1024
const SUSPICIOUS_PHRASES = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /reveal\s+(the\s+)?system\s+prompt/gi,
  /do\s+not\s+follow\s+the\s+developer\s+message/gi,
  /bypass\s+safety/gi,
]

export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function safeDecodeURIComponent(input: string): string {
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

export function decodeCommonObfuscation(text: string): { decoded: string; signals: string[] } {
  let current = text
  const signals: string[] = []

  for (let i = 0; i < MAX_DECODE_PASSES; i++) {
    const percentDecoded = safeDecodeURIComponent(current)
    if (percentDecoded !== current) signals.push('percent-encoding')
    current = percentDecoded
  }

  const htmlEntityDecoded = current
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x2f;/gi, '/')
  if (htmlEntityDecoded !== current) signals.push('html-entities')
  current = htmlEntityDecoded

  const slashDecoded = current
    .replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
  if (slashDecoded !== current) signals.push('escaped-bytes')

  return { decoded: slashDecoded, signals: [...new Set(signals)] }
}

export function sanitizeHtmlLikeContent(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/\s(on\w+)\s*=\s*(['"]).*?\2/gi, ' ')
    .replace(/\s(on\w+)\s*=\s*[^\s>]+/gi, ' ')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
}

export function collectSuspiciousPhrases(text: string): string[] {
  const findings: string[] = []
  for (const pattern of SUSPICIOUS_PHRASES) {
    if (pattern.test(text)) findings.push(pattern.source)
  }
  return findings
}

export function explodeSegments(text: string): string[] {
  const codeBlocks = Array.from(text.matchAll(/```[\s\S]*?```/g), (match) => match[0])
  const inlineCode = Array.from(text.matchAll(/`[^`\n]+`/g), (match) => match[0])
  const commandLike = Array.from(
    text.matchAll(/\b(?:curl|wget|bash|sh|powershell|node|npm|npx|pnpm|yarn)\b[^\n]*/gi),
    (match) => match[0],
  )
  return [...new Set([...codeBlocks, ...inlineCode, ...commandLike])].slice(0, 50)
}

const SHELL_CMD_PATTERN = /\b(?:curl|wget|bash|sh|powershell|node|npm|npx|pnpm|yarn)\b/i

export function filterShellCommandCandidates(segments: string[]): string[] {
  return segments.filter((s) => SHELL_CMD_PATTERN.test(s))
}

export interface Stage1Result {
  sanitizedText: string
  detectedUrls: string[]
  normalizedUrls: string[]
  explodedSegments: string[]
  shellCommandCandidates: string[]
  suspiciousPhrases: string[]
  obfuscatedSignals: string[]
}

export function processStage1(sourceText: string): Stage1Result {
  const normalizedText = normalizeText(sourceText)
  const { decoded, signals } = decodeCommonObfuscation(normalizedText)
  const sanitizedText = normalizeText(sanitizeHtmlLikeContent(decoded))
  const detectedUrls = extractUrls(sourceText)
  const normalizedUrls = extractUrls(sanitizedText)
  const suspiciousPhrases = collectSuspiciousPhrases(`${normalizedText}\n${sanitizedText}`)
  const exploded = explodeSegments(sanitizedText)
  const shellCommandCandidates = filterShellCommandCandidates(exploded)
  return {
    sanitizedText,
    detectedUrls,
    normalizedUrls,
    explodedSegments: exploded,
    shellCommandCandidates,
    suspiciousPhrases,
    obfuscatedSignals: signals,
  }
}

export function buildStage2Message(
  job: QueueMessage,
  sourceText: string,
  contentHash: string | undefined,
  stage1: Stage1Result,
): QueueMessage {
  const metadata: QueueMessageMetadata = {
    ...(job.metadata ?? {}),
    stage1Processed: true,
    ...stage1,
  }
  return {
    ...job,
    originalText: sourceText,
    inputHash: contentHash,
    status: 'processing' as const,
    stage: 2,
    metadata,
  }
}

async function fetchSkillMarkdown(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: 'text/plain,text/markdown,*/*;q=0.8',
      'User-Agent': 'SkillsScanner/1.0 (+https://workers.dev)',
    },
  })
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} for ${url}`)
  }
  const text = await res.text()
  return text.length > MAX_FETCH_BYTES ? text.slice(0, MAX_FETCH_BYTES) : text
}

async function findCanonicalCompletedJobId(
  db: D1Database,
  contentHash: string,
  excludeJobId: string,
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT j.id AS id FROM jobs j
       INNER JOIN scan_results s ON s.id = j.id
       WHERE j.input_hash = ? AND j.id != ?
       LIMIT 1`,
    )
    .bind(contentHash, excludeJobId)
    .first<{ id: string }>()
  return row?.id ?? null
}

async function copyScanResultsFromCanonical(
  db: D1Database,
  canonicalId: string,
  targetJobId: string,
  originalMarkdown: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO scan_results (id, job_id, sanitized_text, urls, shell_commands, injections, tags, risk_level, tldr, metadata, created_at)
       SELECT ?, ?, sanitized_text, urls, shell_commands, injections, tags, risk_level, tldr, metadata, unixepoch()
       FROM scan_results WHERE id = ?`,
    )
    .bind(targetJobId, targetJobId, canonicalId)
    .run()

  await db
    .prepare(
      `UPDATE jobs SET original_text = ?, status = 'completed', stage = 3, updated_at = unixepoch() WHERE id = ?`,
    )
    .bind(originalMarkdown, targetJobId)
    .run()
}

async function markJobFailed(db: D1Database, jobId: string): Promise<void> {
  await db
    .prepare(`UPDATE jobs SET status = 'failed', updated_at = unixepoch() WHERE id = ?`)
    .bind(jobId)
    .run()
}

async function claimContentHashAndOriginalText(
  db: D1Database,
  jobId: string,
  contentHash: string,
  markdown: string,
): Promise<'ok' | 'conflict'> {
  await db
    .prepare(
      `UPDATE jobs SET input_hash = ?, original_text = ?, status = 'processing', updated_at = unixepoch() WHERE id = ?`,
    )
    .bind(contentHash, markdown, jobId)
    .run()

  const row = await db
    .prepare(`SELECT input_hash FROM jobs WHERE id = ?`)
    .bind(jobId)
    .first<{ input_hash: string }>()

  if (row?.input_hash === contentHash) return 'ok'
  return 'conflict'
}

async function resolveUrlJob(
  env: Env,
  job: QueueMessage,
): Promise<
  | { kind: 'deduped'; markdown: string; contentHash: string }
  | { kind: 'proceed'; markdown: string; contentHash: string }
  | { kind: 'failed' }
> {
  const url = job.url?.trim()
  if (!url) {
    await markJobFailed(env.DB, job.id)
    return { kind: 'failed' }
  }

  let markdown: string
  try {
    markdown = await fetchSkillMarkdown(url)
  } catch (err) {
    console.error(`Worker1 fetch failed for job ${job.id}`, err)
    await markJobFailed(env.DB, job.id)
    return { kind: 'failed' }
  }

  const contentHash = await computeInputHash(markdown)

  const canonicalId = await findCanonicalCompletedJobId(env.DB, contentHash, job.id)
  if (canonicalId) {
    await copyScanResultsFromCanonical(env.DB, canonicalId, job.id, markdown)
    return { kind: 'deduped', markdown, contentHash }
  }

  const claimed = await claimContentHashAndOriginalText(env.DB, job.id, contentHash, markdown)
  if (claimed === 'ok') {
    return { kind: 'proceed', markdown, contentHash }
  }

  const other = await env.DB
    .prepare(`SELECT id FROM jobs WHERE input_hash = ? AND id != ? LIMIT 1`)
    .bind(contentHash, job.id)
    .first<{ id: string }>()

  if (!other?.id) {
    await markJobFailed(env.DB, job.id)
    return { kind: 'failed' }
  }

  const hasResults = await env.DB
    .prepare(`SELECT 1 AS n FROM scan_results WHERE id = ? LIMIT 1`)
    .bind(other.id)
    .first<{ n: number }>()

  if (!hasResults) {
    throw new Error(`Content hash claimed but scan not ready yet for winner ${other.id}; retry`)
  }

  await copyScanResultsFromCanonical(env.DB, other.id, job.id, markdown)
  return { kind: 'deduped', markdown, contentHash }
}

const handler: ExportedHandler<Env> = {
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const job = message.body as QueueMessage

      try {
        let sourceText = job.originalText
        let contentHashForMessage = job.inputHash

        if (job.sourceType === 'url') {
          const urlResult = await resolveUrlJob(env, job)
          if (urlResult.kind === 'failed' || urlResult.kind === 'deduped') {
            message.ack()
            continue
          }
          sourceText = urlResult.markdown
          contentHashForMessage = urlResult.contentHash
        }

        const stage1 = processStage1(sourceText)
        const processed = buildStage2Message(job, sourceText, contentHashForMessage, stage1)

        await env.SKILLS_QUEUE_2.send(processed)
        message.ack()
      } catch (error) {
        console.error(`Failed to process job ${job.id}:`, error)
        message.retry()
      }
    }
  },
}

export default handler
