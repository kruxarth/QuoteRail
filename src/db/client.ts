import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { schema } from '@/db/schema';
import { getEnv } from '@/env';

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
};

function createSql() {
  const url = getEnv().DATABASE_URL;
  return postgres(url, {
    max: getEnv().NODE_ENV === 'production' ? 4 : 8,
    prepare: false,
  });
}

export const sql = globalForDb.sql ?? createSql();
if (process.env.NODE_ENV !== 'production') {
  globalForDb.sql = sql;
}

export const db = drizzle(sql, { schema });
export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
