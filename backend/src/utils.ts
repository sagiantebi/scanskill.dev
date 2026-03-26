/**
 * Compute a deterministic SHA-256 hash of normalized input text.
 * Used for early deduplication of skill scan jobs.
 */
export async function computeInputHash(text: string): Promise<string> {
  const normalized = text.trim().toLowerCase()
  const encoder = new TextEncoder()
  const data = encoder.encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Find existing job by input hash
 */
export async function findJobByHash(db: D1Database, inputHash: string) {
  const result = await db
    .prepare('SELECT * FROM jobs WHERE input_hash = ?')
    .bind(inputHash)
    .first()

  return result
}

/**
 * Unique placeholder hash for a URL-sourced job before worker1 resolves content SHA.
 * Must be unique per job row (D1 unique index on input_hash).
 */
export function computePendingUrlJobInputHash(jobId: string): string {
  return `pending-url:${jobId}`
}

/**
 * Find a completed scan for the same source URL (early dedupe before fetch).
 */
export async function findCompletedJobBySourceUrl(db: D1Database, url: string) {
  const normalized = url.trim()
  if (!normalized) return null

  const row = await db
    .prepare(
      `SELECT j.* FROM jobs j
       INNER JOIN scan_results s ON s.id = j.id
       WHERE j.url = ?
       ORDER BY j.created_at DESC
       LIMIT 1`,
    )
    .bind(normalized)
    .first()

  return row
}
