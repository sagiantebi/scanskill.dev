/// <reference types="@cloudflare/workers-types" />
import type { QueueMessage } from './types'
import { detectInjections, extractShellCommands, getTagsFromText } from './types'
import type { QueueMessageMetadata } from '../../../backend/src/types'
import {
  PROGRESS_DETECTION_DONE,
  PROGRESS_STAGE2_DONE,
  raiseJobProgress,
} from '../../../backend/src/job-progress'

export interface Env {
  SKILLS_QUEUE_2: Queue
  SKILLS_QUEUE_3: Queue
  AI: Ai
  DB: D1Database
}

export interface LlmTaggingResponse {
  tags?: string[]
  summary?: string
}

export function dedupeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
}

export function trimToWordLimit(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return words.slice(0, maxWords).join(' ')
}

const FALLBACK_MAX_WORDS = 40
const FALLBACK_MAX_CHARS = 280
const FALLBACK_SUFFIX = '(AI summary unavailable.)'
/** Minimum source length before treating a long summary as an echo of the input. */
const ECHO_CHECK_MIN_INPUT = 200
/** If the model returns a summary this long relative to the source, treat as unusable. */
const ECHO_LENGTH_RATIO = 0.85

export function stripYamlFrontmatter(text: string): string {
  const t = text.trimStart()
  if (!t.startsWith('---')) return text
  const m = t.match(/^---\r?\n[\s\S]*?\r?\n---\s*\r?\n?/)
  if (!m) return text
  return t.slice(m[0].length).trimStart()
}

export function firstMarkdownParagraph(text: string): string {
  const body = stripYamlFrontmatter(text).trim()
  const para = body.split(/\n\s*\n/)[0] ?? body
  return para.replace(/\s+/g, ' ').trim()
}

export function fallbackSummary(text: string): string {
  let blurb = firstMarkdownParagraph(text)
  if (!blurb) blurb = text.trim().split(/\s+/).slice(0, FALLBACK_MAX_WORDS).join(' ')
  blurb = trimToWordLimit(blurb, FALLBACK_MAX_WORDS)
  if (blurb.length > FALLBACK_MAX_CHARS) {
    blurb = `${blurb.slice(0, FALLBACK_MAX_CHARS - 1).trimEnd()}…`
  }
  return blurb ? `${blurb} ${FALLBACK_SUFFIX}` : FALLBACK_SUFFIX
}

export function extractBalancedJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < raw.length; i++) {
    const c = raw[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === '\\' && inString) {
      escape = true
      continue
    }
    if (c === '"') {
      inString = !inString
      continue
    }
    if (!inString) {
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) return raw.slice(start, i + 1)
      }
    }
  }
  return null
}

export function stripMarkdownJsonFence(raw: string): string {
  const t = raw.trim()
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)```$/im)
  if (fenced) return fenced[1].trim()
  const partial = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  return partial.trim()
}

export function parseLlmTaggingJson(raw: string): LlmTaggingResponse | null {
  if (!raw.trim()) return null
  const cleaned = stripMarkdownJsonFence(raw.trim())
  const attempts = [cleaned, raw.trim()]
  for (const chunk of attempts) {
    try {
      const parsed = JSON.parse(chunk) as LlmTaggingResponse
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      /* try next */
    }
    const balanced = extractBalancedJsonObject(chunk)
    if (balanced) {
      try {
        const parsed = JSON.parse(balanced) as LlmTaggingResponse
        if (parsed && typeof parsed === 'object') return parsed
      } catch {
        /* continue */
      }
    }
  }
  return null
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string')
}

export function normalizeLlmTaggingResponse(
  parsed: LlmTaggingResponse | null,
  sourceText: string,
): LlmTaggingResponse | null {
  if (!parsed) return null
  const summary =
    typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
  if (!summary) return null
  const src = sourceText.trim()
  if (src.length >= ECHO_CHECK_MIN_INPUT && summary.length > src.length * ECHO_LENGTH_RATIO) {
    return null
  }
  if (summary === src) return null
  return {
    tags: coerceStringArray(parsed.tags),
    summary,
  }
}

function logAiTaggingFailure(reason: string, raw: string, err?: unknown): void {
  const prefix = raw.slice(0, 80).replace(/\s+/g, ' ')
  console.warn(
    JSON.stringify({
      stage: 'worker2_ai',
      reason,
      rawLen: raw.length,
      rawPrefix: prefix,
      err: err instanceof Error ? err.message : undefined,
    }),
  )
}

export async function getAiTagging(
  env: Env,
  text: string,
  preDetectedTags: string[],
): Promise<LlmTaggingResponse | null> {
  const prompt = [
    'You are a secure skill classifier.',
    'Return strict JSON only with keys: tags (string[]), summary (string).',
    'Summary must be <= 128 words.',
    `Already detected tags: ${preDetectedTags.join(', ') || 'none'}`,
    `Skill text:\n${text}`,
  ].join('\n')

  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct' as keyof AiModels, {
      prompt,
      max_tokens: 450,
    })
    const raw = (response as { response?: string }).response ?? ''
    const parsed = parseLlmTaggingJson(raw)
    if (!parsed) {
      logAiTaggingFailure('parse_failed', raw)
      return null
    }
    const normalized = normalizeLlmTaggingResponse(parsed, text)
    if (!normalized) {
      const sum = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
      const src = text.trim()
      const echoThreshold = src.length * ECHO_LENGTH_RATIO
      const rejectKind =
        sum.length === 0
          ? 'empty_summary'
          : sum === src
            ? 'exact_match'
            : src.length >= ECHO_CHECK_MIN_INPUT && sum.length > echoThreshold
              ? 'echo_length'
              : 'unknown'
      console.log(
        JSON.stringify({
          stage: 'worker2_ai',
          event: 'summary_rejected',
          rejectKind,
          srcLen: src.length,
          summaryLen: sum.length,
          echoThresholdLen: echoThreshold,
        }),
      )
      logAiTaggingFailure('empty_or_echo_summary', raw)
      return null
    }
    console.log(
      JSON.stringify({
        stage: 'worker2_ai',
        event: 'summary_accepted',
        srcLen: text.trim().length,
        summaryLen: (normalized.summary ?? '').length,
      }),
    )
    return normalized
  } catch (error) {
    logAiTaggingFailure('ai_error', '', error)
    return null
  }
}

export function detectObfuscationSignals(text: string): string[] {
  const signals: string[] = []
  if (/(?:base64|atob\(|fromcharcode)/i.test(text)) signals.push('encoding-functions')
  if (/%[0-9a-f]{2}/i.test(text)) signals.push('percent-encoding')
  if (/\\x[0-9a-f]{2}|\\u[0-9a-f]{4}/i.test(text)) signals.push('escaped-bytes')
  return signals
}

export function computeRiskLevel(input: {
  injections: string[]
  shellCommands: string[]
  suspiciousPhrases: string[]
  obfuscatedSignals: string[]
}): 'low' | 'medium' | 'high' {
  if (input.injections.length > 0) return 'high'
  if (input.shellCommands.length > 0 && input.obfuscatedSignals.length > 0) return 'high'
  if (input.shellCommands.length > 0 || input.suspiciousPhrases.length > 0 || input.obfuscatedSignals.length > 0) return 'medium'
  return 'low'
}

export interface Stage2DetectionResult {
  shellCommands: string[]
  injections: string[]
  suspiciousPhrases: string[]
  obfuscatedSignals: string[]
  deterministicTags: string[]
}

export function runDeterministicDetection(
  text: string,
  metadata: QueueMessageMetadata,
): Stage2DetectionResult {
  const shellCommands = extractShellCommands(text, metadata.shellCommandCandidates)
  const injections = detectInjections(text)
  const suspiciousPhrases = metadata.suspiciousPhrases ?? []
  const obfuscatedSignals = dedupeTags([
    ...(metadata.obfuscatedSignals ?? []),
    ...detectObfuscationSignals(text),
  ])
  const deterministicTags = dedupeTags([
    ...getTagsFromText(text),
    ...(obfuscatedSignals.length > 0 ? ['obfuscated'] : []),
    ...(shellCommands.length > 0 ? ['shell-commands'] : []),
    'programming',
  ])
  return { shellCommands, injections, suspiciousPhrases, obfuscatedSignals, deterministicTags }
}

export interface Stage2Result {
  tags: string[]
  summary: string
  riskLevel: 'low' | 'medium' | 'high'
  shellCommands: string[]
  injections: string[]
  obfuscatedSignals: string[]
}

export function assembleStage2Result(
  text: string,
  detection: Stage2DetectionResult,
  aiResult: LlmTaggingResponse | null,
): Stage2Result {
  const aiTags = dedupeTags(aiResult?.tags ?? [])
  const tags = dedupeTags([...detection.deterministicTags, ...aiTags])
  const summary = trimToWordLimit(aiResult?.summary?.trim() || fallbackSummary(text), 128)
  const riskLevel = computeRiskLevel(detection)
  return {
    tags,
    summary,
    riskLevel,
    shellCommands: detection.shellCommands,
    injections: detection.injections,
    obfuscatedSignals: detection.obfuscatedSignals,
  }
}

export function buildStage3Message(
  job: QueueMessage,
  metadata: QueueMessageMetadata,
  stage2: Stage2Result,
): QueueMessage {
  const nextMetadata: QueueMessageMetadata = {
    ...metadata,
    stage2Processed: true,
    ...stage2,
  }
  return {
    ...job,
    status: 'processing' as const,
    stage: 3,
    metadata: nextMetadata,
  }
}

const handler: ExportedHandler<Env> = {
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const job = message.body as QueueMessage

      try {
        const metadata: QueueMessageMetadata = job.metadata ?? {}
        const text = metadata.sanitizedText || job.originalText || ''

        const detection = runDeterministicDetection(text, metadata)
        await raiseJobProgress(env.DB, job.id, PROGRESS_DETECTION_DONE)
        const aiResult = await getAiTagging(env, text, detection.deterministicTags)
        const stage2 = assembleStage2Result(text, detection, aiResult)
        console.log(
          JSON.stringify({
            stage: 'worker2',
            event: 'stage2_complete',
            jobId: job.id,
            sourceLen: text.length,
            aiTaggingUsed: aiResult != null,
            summaryLen: stage2.summary.length,
            usedFallbackSuffix: stage2.summary.includes(FALLBACK_SUFFIX),
            summaryHeadAscii: stage2.summary.slice(0, 100).replace(/[^\x20-\x7E]/g, ' '),
          }),
        )
        const processed = buildStage3Message(job, metadata, stage2)

        await raiseJobProgress(env.DB, job.id, PROGRESS_STAGE2_DONE)
        await env.SKILLS_QUEUE_3.send(processed)
        message.ack()
      } catch (error) {
        console.error(`Worker2 failed for job ${job.id}:`, error)
        message.retry()
      }
    }
  },
}

export default handler
