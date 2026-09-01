import { z } from 'zod';
import { OPENCODE_GO_BASE_URL, SELLER_MODEL } from '@/shared/constants';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).default('postgres://quoterail:quoterail@localhost:5432/quoterail'),
  OPENCODE_GO_API_KEY: z.string().optional().default(''),
  OPENCODE_GO_BASE_URL: z.url().default(OPENCODE_GO_BASE_URL),
  SELLER_MODEL: z.literal(SELLER_MODEL).default(SELLER_MODEL),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  BUYER_MCP_TOKEN: z.string().min(8).default('test-buyer-token'),
  MERCHANT_ADMIN_PASSWORD: z.string().min(8).default('test-admin-password'),
  SESSION_SIGNING_SECRET: z.string().min(16).default('test-session-signing-secret-32b'),
  APP_BASE_URL: z.string().min(1).default('http://localhost:3000'),
  DEMO_RESET_ENABLED: z.string().optional().default('false'),
  REAL_RAZORPAY_TESTS_ENABLED: z.string().optional().default('false'),
  FAKE_AI: z.string().optional().default(''),
  FAKE_PAYMENTS: z.string().optional().default(''),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}

export function fakeAiEnabled(env = getEnv()): boolean {
  if (env.FAKE_AI === 'true' || env.NODE_ENV === 'test') return true;
  return !env.OPENCODE_GO_API_KEY;
}

export function fakePaymentsEnabled(env = getEnv()): boolean {
  if (env.FAKE_PAYMENTS === 'true' || env.NODE_ENV === 'test') return true;
  if (env.REAL_RAZORPAY_TESTS_ENABLED === 'true') return false;
  return !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET;
}

export function assertProductionSecrets(env = getEnv()): void {
  if (env.NODE_ENV !== 'production') return;
  if (!env.OPENCODE_GO_API_KEY && env.FAKE_AI !== 'true') {
    throw new Error('OPENCODE_GO_API_KEY is required outside fake/test mode');
  }
  if (env.SELLER_MODEL !== SELLER_MODEL) {
    throw new Error(`SELLER_MODEL must remain ${SELLER_MODEL} for the submission`);
  }
}

export function demoResetEnabled(env = getEnv()): boolean {
  return env.DEMO_RESET_ENABLED === 'true';
}
