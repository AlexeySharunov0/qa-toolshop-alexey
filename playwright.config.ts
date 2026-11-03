import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const UI_URL = process.env.UI_URL ?? 'http://localhost:4200';
const API_URL = process.env.API_URL ?? 'http://localhost:8091';

/**
 * Two projects, deliberately:
 *  - `api`  hits the REST API directly on :8091 (the Angular UI calls the same
 *           origin, so this is the same contract the browser uses);
 *  - `ui-chromium` drives the Angular app on :4200.
 * baseURL is never a public host: the assignment requires every trace, session
 * and request to point at the local instance.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 90_000,
  expect: { timeout: 15_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],

  outputDir: 'test-results',

  use: {
    // The application marks every meaningful element with data-test, so the
    // suite never depends on CSS classes or DOM structure.
    testIdAttribute: 'data-test',
    // Traces are recorded for every run, not only for failures.
    // Reason: the tests that reproduce the known defects are marked with
    // test.fail(), and Playwright treats an expected failure as a passing run,
    // so 'retain-on-failure' would keep no evidence at all for exactly the runs
    // that matter most. Traces for the defects are copied to reports/traces/.
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'api',
      testMatch: /tests\/api\/.*\.spec\.ts/,
      use: { baseURL: API_URL },
    },
    {
      name: 'ui-chromium',
      testMatch: /tests\/ui\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: UI_URL },
    },
  ],
});
