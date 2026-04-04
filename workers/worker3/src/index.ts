/// <reference types="@cloudflare/workers-types" />
import type { QueueMessage, QueueMessageMetadata, SanitizedSkill } from './types'
import {
  PROGRESS_COMPLETE,
  PROGRESS_FINALIZING,
  raiseJobProgress,
} from '../../../backend/src/job-progress'

export interface Env {
  DB: D1Database
}

export function assembleSanitizedSkill(
  job: QueueMessage,
  metadata: QueueMessageMetadata,
): SanitizedSkill {
  return {
    originalText: job.originalText,
    sanitizedText: metadata.sanitizedText || job.originalText,
    urls: metadata.detectedUrls || [],
    shellCommands: metadata.shellCommands || [],
    injections: metadata.injections || [],
    tags: metadata.tags || ['uncategorized'],
    riskLevel: metadata.riskLevel || 'medium',
    tldr: metadata.summary || 'AI Agent skill set requiring review.',
    metadata: {
      processedBy: 'worker3',
      stage: 3,
      normalizedUrls: metadata.normalizedUrls ?? [],
      detectedUrls: metadata.detectedUrls ?? [],
      sourceType: job.sourceType,
      url: job.url,
    },
  }
}

export function serializeScanResultBindings(
  jobId: string,
  skill: SanitizedSkill,
): [string, string, string, string, string, string, string, string, string, string] {
  return [
    jobId,
    jobId,
    skill.sanitizedText,
    JSON.stringify(skill.urls),
    JSON.stringify(skill.shellCommands),
    JSON.stringify(skill.injections),
    JSON.stringify(skill.tags),
    skill.riskLevel,
    skill.tldr ?? '',
    JSON.stringify(skill.metadata),
  ]
}

const handler: ExportedHandler<Env> = {
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const job = message.body as QueueMessage

      try {
        // Orphaned messages: jobs row gone (e.g. manual D1 reset) while this message was still in queue 3.
        const jobRow = await env.DB.prepare('SELECT id FROM jobs WHERE id = ?')
          .bind(job.id)
          .first<{ id: string }>()
        if (!jobRow) {
          console.warn(
            `Worker3 skipping job ${job.id}: no jobs row (likely DB reset while message was in flight)`,
          )
          message.ack()
          continue
        }

        const metadata: QueueMessageMetadata = job.metadata ?? {}
        const sanitizedSkill = assembleSanitizedSkill(job, metadata)
        const bindings = serializeScanResultBindings(job.id, sanitizedSkill)

        await raiseJobProgress(env.DB, job.id, PROGRESS_FINALIZING)

        await env.DB.prepare(
          `INSERT INTO scan_results (id, job_id, sanitized_text, urls, shell_commands, injections, tags, risk_level, tldr, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(...bindings)
          .run()

        await env.DB.prepare(
          `UPDATE jobs SET status = 'completed', stage = 3, progress = ?, updated_at = unixepoch() WHERE id = ?`,
        )
          .bind(PROGRESS_COMPLETE, job.id)
          .run()

        console.log(`Skill scan completed for job ${job.id}. Risk: ${sanitizedSkill.riskLevel}`)
        message.ack()
      } catch (error) {
        console.error(`Worker3 failed for job ${job.id}:`, error)
        message.retry()
      }
    }
  },
}

export default handler
