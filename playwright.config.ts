import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.APP_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      FAKE_AI: 'true',
      FAKE_PAYMENTS: 'true',
      DEMO_RESET_ENABLED: 'true',
      BUYER_MCP_TOKEN: process.env.BUYER_MCP_TOKEN ?? 'test-buyer-token',
      MERCHANT_ADMIN_PASSWORD: process.env.MERCHANT_ADMIN_PASSWORD ?? 'test-admin-password',
      SESSION_SIGNING_SECRET:
        process.env.SESSION_SIGNING_SECRET ?? 'test-session-signing-secret-32b',
      DATABASE_URL: 'postgres://quoterail:quoterail@localhost:5432/quoterail',
      APP_BASE_URL: 'http://localhost:3000',
      SELLER_MODEL: 'gpt-5.6-luna',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
