import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    server: {
      deps: {
        // Published dsh client packages ship lib bundles with bare .css
        // imports the web shell owns at runtime; inlining lets vite's
        // transform stub them during tests.
        inline: [/@deepseek-ai\//],
      },
    },
  },
})
