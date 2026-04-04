/// <reference types="@cloudflare/workers-types" />

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database
    SKILLS_QUEUE_1: Queue
    SKILL_SCAN_DEDUP_ENABLED?: string
  }
}

declare module 'cloudflare:workers' {
  interface ProvidedEnv {
    DB: D1Database
    SKILLS_QUEUE_1: Queue
    SKILL_SCAN_DEDUP_ENABLED?: string
  }
}
