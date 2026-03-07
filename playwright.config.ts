import { defineConfig, type ReporterDescription } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const jsonOutputFile = process.env.PLAYWRIGHT_JSON_OUTPUT_FILE;
const reporter: ReporterDescription[] = jsonOutputFile
  ? [
      ['line'],
      ['json', { outputFile: jsonOutputFile }],
    ]
  : [['list']];

export default defineConfig({
  testDir: 'tests',
  timeout: 60 * 1000,
  workers: Number(process.env.PLAYWRIGHT_WORKERS || '1'),
  reporter,
  expect: {
    timeout: 10 * 1000,
  },
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
});
