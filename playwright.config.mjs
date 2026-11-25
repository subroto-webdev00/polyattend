import { defineConfig, devices } from '@playwright/test';

// E2E tests drive the real production build against a real database.
//
//   1. npm run build          (kill any dev/prod server first — Prisma's
//                              engine file is locked while a server runs)
//   2. npm run test:e2e
//
// webServer only *starts* the already-built app so a stale build is never
// silently rebuilt behind your back; CI runs the build step explicitly.
const PORT = Number(process.env.E2E_PORT || 3101);
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // One worker: the tests share one e2e admin account and the login endpoint
  // is rate limited (8 attempts / 15 min per IP+email), so parallel logins
  // would only fight each other.
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
