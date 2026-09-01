import 'dotenv/config';
import { db, sql } from '@/db/client';
import { SystemClock } from '@/shared/clock';
import { resetDemo } from '@/server/catalog/seed';

async function main() {
  const result = await resetDemo(db, new SystemClock());
  console.log(
    JSON.stringify(
      {
        ok: true,
        merchantId: result.merchantId,
        demoThursday: result.thursday,
        demoFriday: result.friday,
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
