import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      FAKE_AI: 'true',
      FAKE_PAYMENTS: 'true',
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://quoterail:quoterail@localhost:5432/quoterail',
      BUYER_MCP_TOKEN: 'test-buyer-token',
      MERCHANT_ADMIN_PASSWORD: 'test-admin-password',
      SESSION_SIGNING_SECRET: 'test-session-signing-secret-32b',
      APP_BASE_URL: 'http://localhost:3000',
      SELLER_MODEL: 'gpt-5.6-luna',
      OPENCODE_GO_BASE_URL: 'https://opencode.ai/zen/go/v1',
      DEMO_RESET_ENABLED: 'true',
      REAL_RAZORPAY_TESTS_ENABLED: 'false',
    },
  },
});
