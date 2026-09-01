import { beforeAll } from 'vitest';
import { config } from 'dotenv';

config({ path: '.env' });

beforeAll(() => {
  process.env.FAKE_AI = 'true';
  process.env.FAKE_PAYMENTS = 'true';
  process.env.REAL_RAZORPAY_TESTS_ENABLED = 'false';
  process.env.DATABASE_URL =
    process.env.LOCAL_DATABASE_URL ?? 'postgres://quoterail:quoterail@localhost:5432/quoterail';
});
