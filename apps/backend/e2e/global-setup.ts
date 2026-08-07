import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/**
 * Applies the Drizzle migrations to the dedicated test database before the
 * integration suite runs. Requires the dockerized Postgres to be up
 * (`docker compose up -d db`), which auto-creates `booking_test`.
 *
 * Uses the same `drizzle-orm/node-postgres` migrator as the runtime
 * (`src/db/migrate.ts`); the migrations folder is resolved relative to this
 * file so it works regardless of the process working directory.
 */
export default async function globalSetup(): Promise<void> {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/booking_test?schema=public';

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await migrate(drizzle(pool), { migrationsFolder: join(__dirname, '../drizzle') });
  } finally {
    await pool.end();
  }
}
