import type {
  CategoryResponse,
  ScanResponse,
  StatsResponse,
  TagsResponse,
} from '../types'

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch('/api/stats')
  if (!res.ok) throw new Error('Failed to load stats')
  return res.json() as Promise<StatsResponse>
}

export async function fetchTags(): Promise<TagsResponse> {
  const res = await fetch('/api/tags')
  if (!res.ok) throw new Error('Failed to load tags')
  return res.json() as Promise<TagsResponse>
}

export async function fetchScan(id: string): Promise<ScanResponse> {
  const res = await fetch(`/api/skills/${id}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Scan not found')
    throw new Error('Failed to load scan')
  }
  return res.json() as Promise<ScanResponse>
}

export async function fetchByTag(tag: string): Promise<CategoryResponse> {
  const res = await fetch(
    `/api/skills/by-tag/${encodeURIComponent(tag)}`,
  )
  if (!res.ok) throw new Error('Failed to load skills')
  return res.json() as Promise<CategoryResponse>
}

export async function submitScan(
  body: Record<string, string | undefined>,
): Promise<{ success: boolean; jobId: string }> {
  const res = await fetch('/api/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string
      issues?: { message?: string }[]
    } | null
    const fromZod = err?.issues?.[0]?.message
    const message =
      typeof fromZod === 'string' ? fromZod : err?.error ?? 'Submit failed'
    throw new Error(message)
  }
  return res.json() as Promise<{ success: boolean; jobId: string }>
}
