export type ScanResultPayload = {
  sanitizedText: string
  urls: string[]
  normalizedUrls: string[]
  shellCommands: string[]
  injections: string[]
  tags: string[]
  riskLevel: string
  tldr: string | null
}

export type ScanResponse = {
  id: string
  status: string
  progress: number
  stage?: number
  sourceUrl?: string
  originalSkillMarkdown?: string
  result?: ScanResultPayload
}

export type StatsResponse = { completedScans: number }

export type TagEntry = { tag: string; count: number }
export type TagsResponse = { tags: TagEntry[] }

export type CategorySkill = {
  id: string
  tldr: string | null
  riskLevel: string | null
  preview: string
}

export type CategoryResponse = {
  tag: string
  skills: CategorySkill[]
}
