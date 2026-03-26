/// <reference types="@cloudflare/workers-types" />
import type { QueueMessage } from './types'
import { detectInjections, extractShellCommands, getTagsFromText } from './types'
import type { QueueMessageMetadata } from '../../../backend/src/types'

export interface Env {
  SKILLS_QUEUE_2: Queue
  SKILLS_QUEUE_3: Queue
  AI: Ai
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

export function fallbackSummary(text: string): string {
  return trimToWordLimit(text, 128)
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
      max_tokens: 350,
    })
    const raw = (response as { response?: string }).response ?? ''
    const jsonSlice = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
    if (!jsonSlice) return null
    const parsed = JSON.parse(jsonSlice) as LlmTaggingResponse
    return parsed
  } catch {
    return null
  }
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
  const shellCommands = extractShellCommands(text)
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
        const aiResult = await getAiTagging(env, text, detection.deterministicTags)
        const stage2 = assembleStage2Result(text, detection, aiResult)
        const processed = buildStage3Message(job, metadata, stage2)

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
