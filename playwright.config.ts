import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './qa',
  testMatch: ['e2e.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:3123',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'PORT=3123 NODE_ENV=production npx tsx server/index.ts',
    url: 'http://127.0.0.1:3123/api/health',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
