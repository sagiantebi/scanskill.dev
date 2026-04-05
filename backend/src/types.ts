export interface QueueMessage {
  id: string
  inputHash?: string
  originalText: string
  sourceType: 'text' | 'url'
  url?: string
  userId?: string
  /**
   * Mirrors API `SKILL_SCAN_DEDUP_ENABLED`. When false, worker1 uses a per-job content hash so
   * identical skill text still runs the full pipeline (no scan_results copy from a canonical job).
   */
  apiDedupEnabled?: boolean
  status: 'queued' | 'processing' | 'completed' | 'failed'
  stage: number
  timestamp: number
  metadata?: QueueMessageMetadata
}

export interface QueueMessageMetadata {
  stage1Processed?: boolean
  stage2Processed?: boolean
  sanitizedText?: string
  detectedUrls?: string[]
  normalizedUrls?: string[]
  explodedSegments?: string[]
  shellCommandCandidates?: string[]
  suspiciousPhrases?: string[]
  obfuscatedSignals?: string[]
  shellCommands?: string[]
  injections?: string[]
  tags?: string[]
  riskLevel?: 'low' | 'medium' | 'high'
  summary?: string
  [key: string]: unknown
}

export interface ScanResult {
  skills: string[]
  confidence: number
  keywords: string[]
  category: string
}

export interface SanitizedSkill {
  originalText: string
  sanitizedText: string
  urls: string[]
  shellCommands: string[]
  injections: string[]
  tags: string[]
  riskLevel: 'low' | 'medium' | 'high'
  tldr?: string
  metadata?: Record<string, any>
}

export interface Job {
  id: string
  inputHash: string
  originalText: string
  sourceType: 'text' | 'url'
  url?: string
  userId?: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  stage: number
  progress?: number
  createdAt?: number
  updatedAt?: number
}
