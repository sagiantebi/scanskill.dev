import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    include: ['tests/dedup-off.integration.test.ts'],
    poolOptions: {
      workers: {
        main: './src/index.ts',
        wrangler: { configPath: './wrangler.vitest.dedup-off.jsonc' },
        miniflare: {
          compatibilityDate: '2025-03-01',
        },
      },
    },
  },
})
