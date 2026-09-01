import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
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
