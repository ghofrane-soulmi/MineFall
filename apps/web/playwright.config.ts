import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end: a real API + the real web app + real browsers. Uses dedicated ports so it can
 * run next to your dev servers. Run with `pnpm --filter @minefall/web test:e2e`.
 */
const API_PORT = 3100;
const WEB_PORT = 5174;
const isCI = Boolean(process.env['CI']);
/** Test an already running deployment instead (e.g. the Docker stack: http://localhost:8090). */
const externalBaseUrl = process.env['E2E_BASE_URL'];

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Start the API + web dev server ourselves, unless testing an external deployment.
  ...(externalBaseUrl
    ? {}
    : {
        webServer: [
          {
            command: 'node ../api/dist/main.js',
            env: {
              PORT: String(API_PORT),
              CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
              // Optional: also exercise persistence when a database is available.
              DATABASE_URL: process.env['DATABASE_URL'] ?? '',
            },
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
      }),
});
