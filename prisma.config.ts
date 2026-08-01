import 'dotenv/config';

import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 CLI configuration. The connection URL no longer lives in
 * `schema.prisma`; migrate/introspect read it from here (loaded from `.env`
 * in dev, or the real `DATABASE_URL` env var in Docker). The runtime client
 * gets its connection from the `pg` driver adapter in `PrismaService`.
 *
 * A missing URL is tolerated so `prisma generate` (which needs no database)
 * still runs during `postinstall`/Docker build; migrate will fail loudly if
 * it is genuinely unset.
 */
export default defineConfig({
  schema: 'apps/backend/prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
