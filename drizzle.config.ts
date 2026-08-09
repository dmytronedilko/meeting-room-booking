import 'dotenv/config';

import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration: the schema (`apps/backend/src/db/schema.ts`) is the
 * source of truth, and `generate` writes SQL migrations to `apps/backend/drizzle`.
 *
 * The connection URL is read from the environment (loaded from `.env` in dev, or
 * the real `DATABASE_URL` in Docker/CI). Only connection-bound commands
 * (migrate/push/pull) need it — `generate` works off the schema alone — so a
 * missing URL is tolerated (empty string), exactly as the old `prisma.config.ts`
 * did for `prisma generate`.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './apps/backend/src/db/schema.ts',
  out: './apps/backend/drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
