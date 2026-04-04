/// <reference types="@cloudflare/workers-types" />

/** Initial value when a job row is inserted (queued). */
export const PROGRESS_QUEUED = 8
/** Text: worker1 started. URL: after fetch + claim. */
export const PROGRESS_PROCESSING = 15
/** URL: markdown fetched successfully. */
export const PROGRESS_URL_FETCHED = 28
/** URL: content hash claimed, ready to sanitize. */
export const PROGRESS_URL_CLAIMED = 32
/** Stage1 (sanitize/explode) finished, enqueued for detection. */
export const PROGRESS_STAGE1_DONE = 42
/** Deterministic detection finished, before AI. */
export const PROGRESS_DETECTION_DONE = 58
/** Stage2 (tags/summary/risk) finished, enqueued for persist. */
export const PROGRESS_STAGE2_DONE = 82
/** Worker3 about to write scan_results. */
export const PROGRESS_FINALIZING = 94
export const PROGRESS_COMPLETE = 100

export function progressPhaseFromValue(progress: number): string {
  if (progress >= 100) return 'Complete'
  if (progress >= PROGRESS_FINALIZING) return 'Saving results…'
  if (progress >= PROGRESS_STAGE2_DONE) return 'Finalizing…'
  if (progress >= PROGRESS_DETECTION_DONE) return 'Classifying with AI…'
  if (progress >= PROGRESS_STAGE1_DONE) return 'Scanning for risks…'
  if (progress >= PROGRESS_PROCESSING) return 'Preparing skill…'
  return 'Queued…'
}

/** Monotonic raise: queue retries never move the bar backward. */
export async function raiseJobProgress(
  db: D1Database,
  jobId: string,
  atLeast: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE jobs SET progress = CASE WHEN COALESCE(progress, 0) < ?1 THEN ?1 ELSE progress END,
        updated_at = unixepoch() WHERE id = ?2`,
    )
    .bind(atLeast, jobId)
    .run()
}

export async function markJobProcessing(
  db: D1Database,
  jobId: string,
  atLeast: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE jobs SET status = 'processing',
        progress = CASE WHEN COALESCE(progress, 0) < ?1 THEN ?1 ELSE COALESCE(progress, 0) END,
        updated_at = unixepoch() WHERE id = ?2`,
    )
    .bind(atLeast, jobId)
    .run()
}

export function resolveJobProgressPercent(job: Record<string, unknown>): number {
  const status = typeof job.status === 'string' ? job.status : ''
  if (status === 'completed') return 100

  const raw = job.progress
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    const n = Math.floor(raw)
    if (status === 'failed') return Math.min(Math.max(n, 0), 100)
    return Math.min(Math.max(n, 0), 99)
  }

  const stageNum =
    typeof job.stage === 'number' ? job.stage : Number(job.stage ?? 0) || 0
  return stageNum ? Math.min(stageNum * 33, 99) : 33
}
