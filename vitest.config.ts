import { defineConfig } from 'vitest/config'

// Unit-тесты логики. E2E-тесты лежат в e2e/ и запускаются Playwright.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
})
