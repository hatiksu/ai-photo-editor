import { defineConfig, devices } from '@playwright/test'

const PORT = 4181

// E2E-тесты в мобильном браузере против собранной версии (с Service Worker).
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'off',
  },
  projects: [{ name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
