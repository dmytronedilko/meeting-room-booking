import { defineConfig, devices } from '@playwright/test';

/**
 * Browser e2e for the frontend. The suite drives the real app end-to-end
 * (Next.js UI → Nest API → Postgres), so the full stack must be reachable at
 * `E2E_BASE_URL` — by default the Traefik proxy that docker-compose publishes on
 * :80. Locally: `docker compose up -d --wait db backend frontend traefik`, then
 * `npm run test:e2e`. (The backend API/integration suite lives separately in
 * `apps/backend/e2e`.)
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
