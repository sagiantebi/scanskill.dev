import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: '@cloudflare/vitest-pool-workers',
    poolOptions: {
      workers: {
        wranglerConfig: 'wrangler.jsonc',
        miniflare: {
          compatibilityDate: '2025-03-01',
        },
      },
    },
  },
})
