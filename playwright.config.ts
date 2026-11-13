import * as fs from 'fs';

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:9000';
const authStateFile = 'playwright-tests/.auth/state.json';
const hasGlobalSetup = !process.env.SKIP_PLUGIN_SETUP;
const storageState = hasGlobalSetup || fs.existsSync(authStateFile) ? authStateFile : undefined;

if (!storageState) {
  console.warn(
    `Warning: Auth state file "${authStateFile}" not found.` +
      ' Tests will run without stored authentication.',
  );
}

/**
 * Playwright configuration for Cluster Update Console Plugin E2E tests
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './playwright-tests/tests',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [
        ['html', { outputFolder: 'playwright-tests/screenshots/html' }],
        ['junit', { outputFile: 'playwright-tests/screenshots/junit-results.xml' }],
        ['json', { outputFile: 'playwright-tests/screenshots/test-results.json' }],
      ]
    : [['html', { open: 'never' }]],
  outputDir: 'playwright-tests/screenshots/test-results',
  globalSetup: process.env.SKIP_PLUGIN_SETUP
    ? undefined
    : './playwright-tests/support/global-setup.ts',
  globalTeardown: process.env.SKIP_PLUGIN_SETUP
    ? undefined
    : './playwright-tests/support/global-teardown.ts',
  use: {
    baseURL,
    storageState,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1080 },
      },
    },
  ],

  // Web server configuration for local dev
  webServer: process.env.CI
    ? undefined
    : {
        command: 'yarn start',
        url: 'http://localhost:9001',
        reuseExistingServer: true,
        timeout: 120000,
      },
});
