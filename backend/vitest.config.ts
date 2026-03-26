import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        main: './src/index.ts',
        // Worker-only config: main wrangler.jsonc points at ../frontend/dist (missing before frontend build).
        wrangler: { configPath: './wrangler.vitest.jsonc' },
        miniflare: {
          compatibilityDate: '2025-03-01',
        },
      },
    },
  },
})
