/**
 * Applies pending Drizzle migrations, then exits. One code path, three callers:
 *  - `npm run db:migrate` (dev),
 *  - the integration suite's `global-setup.ts` (against `booking_test`),
 *  - the Docker entrypoint, bundled as `migrate.js`, at container start.
 *
 * Kept dependency-light (no Nest DI) so it runs both via `@swc-node/register`
 * (dev/CI) and as a compiled bundle in Docker — the same shape as the seed.
 */
import 'dotenv/config';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

// The migrations live at `apps/backend/drizzle` when run from the workspace root
// (dev/CI), or `drizzle` when run from `/app` in the container (the Dockerfile
// copies the folder there). `DRIZZLE_MIGRATIONS_DIR` overrides both.
function resolveMigrationsFolder(): string {
  const override = process.env.DRIZZLE_MIGRATIONS_DIR;
  if (override) {
    return resolve(process.cwd(), override);
  }
  const fromRoot = resolve(process.cwd(), 'apps/backend/drizzle');
  return existsSync(fromRoot) ? fromRoot : resolve(process.cwd(), 'drizzle');
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });
  try {
    await migrate(drizzle(pool), { migrationsFolder: resolveMigrationsFolder() });
    console.log('Migrations applied.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
