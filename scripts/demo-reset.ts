import 'dotenv/config';
import { db, sql } from '@/db/client';
import { getEnv, demoResetEnabled } from '@/env';
import { SystemClock } from '@/shared/clock';
import { resetDemo } from '@/server/catalog/seed';

async function main() {
  if (!demoResetEnabled(getEnv()) && getEnv().NODE_ENV === 'production') {
    console.error('DEMO_RESET_ENABLED is false; refusing to reset production data.');
    process.exit(1);
  }
  const result = await resetDemo(db, new SystemClock());
  console.log(
    JSON.stringify(
      {
        ok: true,
        demoThursday: result.thursday,
        demoFriday: result.friday,
        copiedRfqDate: result.friday,
      },
      null,
      2,
    ),
  );
  await sql.end({ timeout: 1 });
}

main().catch(async (error) => {
  console.error(error);
  await sql.end({ timeout: 1 });
  process.exit(1);
});
