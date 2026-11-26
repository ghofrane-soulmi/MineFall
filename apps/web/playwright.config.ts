import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end: a real API + the real web app + real browsers. Uses dedicated ports so it can
 * run next to your dev servers. Run with `pnpm --filter @minefall/web test:e2e`.
 */
const API_PORT = 3100;
const WEB_PORT = 5174;
const isCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ../api/dist/main.js',
      env: { PORT: String(API_PORT), CORS_ORIGIN: `http://localhost:${WEB_PORT}` },
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !isCI,
    },
    {
      command: `vite --port ${WEB_PORT} --strictPort`,
      env: {
        MINEFALL_API_URL: `http://localhost:${API_PORT}`,
        MINEFALL_WEB_PORT: String(WEB_PORT),
      },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !isCI,
    },
  ],
});
