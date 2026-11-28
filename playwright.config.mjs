import { defineConfig } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const port = Number(process.env.E2E_PORT || 3100);
// The server keeps its data in ./.data of its working directory: run it from a scratch folder
// so tests never touch the real .data of the project.
const runDirectory = resolve('.e2e-run');
// Reset only in the main process: workers load this file too, while the server is already running.
if (process.env.TEST_WORKER_INDEX === undefined) {
  rmSync(runDirectory, { recursive: true, force: true });
  mkdirSync(runDirectory, { recursive: true });
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    // Edge ships with Windows. Set E2E_CHANNEL=chrome (or an empty value to use Playwright's own Chromium) to change it.
    channel: process.env.E2E_CHANNEL === undefined ? 'msedge' : process.env.E2E_CHANNEL || undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node ${JSON.stringify(resolve('server.mjs'))}`,
    cwd: runDirectory,
    env: { PORT: String(port), DEMO: 'true' },
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
