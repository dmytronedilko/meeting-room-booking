import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../db/schema';

/** DI token for the raw `pg` connection pool (owned/closed by this module). */
export const DATABASE_POOL = Symbol('DATABASE_POOL');

/** DI token for the Drizzle client — inject with `@Inject(DRIZZLE)`. */
export const DRIZZLE = Symbol('DRIZZLE');

/** The typed Drizzle client (schema-aware, so `db.query.*` relational reads work). */
export type DrizzleDB = NodePgDatabase<typeof schema>;

/**
 * The single database access point, replacing the former `PrismaModule`.
 * Builds a `pg` pool from `DATABASE_URL` and a schema-bound Drizzle client over
 * it; the module owns the pool's lifecycle and closes it on shutdown (triggered
 * by `app.enableShutdownHooks()`).
 *
 * Drizzle needs no client-generation step and no query-engine binary — the
 * connection is the `pg` driver, same as Prisma 7's adapter used underneath.
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: (): Pool => {
        const connectionString = process.env['DATABASE_URL'];
        if (!connectionString) {
          throw new Error('DATABASE_URL is not set');
        }
        return new Pool({ connectionString });
      },
    },
    {
      provide: DRIZZLE,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool): DrizzleDB => drizzle(pool, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
