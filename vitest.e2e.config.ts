import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { include: ['tests/searxng.e2e.ts'], testTimeout: 60_000 } })
