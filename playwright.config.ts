import { defineConfig, devices } from '@playwright/test'

const BASE_URL = 'http://localhost:5173/butcherApp/'

export default defineConfig({
  testDir: './e2e',
  // The walkthrough is meant to be watched in order, and every spec seeds the
  // same database, so they must not race each other.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'on',
    // Slow the run down to something a person can follow: `npm run e2e:show`.
    launchOptions: { slowMo: Number(process.env.SLOWMO ?? 0) },
  },
  projects: [
    {
      name: 'ipad',
      use: { ...devices['Desktop Chrome'], viewport: { width: 834, height: 1000 } },
    },
  ],
})
