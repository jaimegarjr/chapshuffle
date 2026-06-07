import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  maxFailures: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  timeout: 30_000,
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
