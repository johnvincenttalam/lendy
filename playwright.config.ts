import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke tests for the app shell at phone and desktop sizes. Each test gets a
 * fresh browser context, so storage starts empty and no real data is touched.
 */
const PORT = 47614
/** The production build, for the offline test. */
const PREVIEW_PORT = 47615

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: 'Asia/Manila',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'offline',
      testMatch: 'offline.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PREVIEW_PORT}` },
    },
    {
      name: 'phone',
      testIgnore: 'offline.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'desktop',
      testIgnore: 'offline.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      command: `npx vite --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npm run build && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})
