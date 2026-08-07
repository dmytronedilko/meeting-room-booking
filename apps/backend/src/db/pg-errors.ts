/** PostgreSQL SQLSTATE codes the application handles. */
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_EXCLUSION_VIOLATION = '23P01';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * True when `error` — or any error in its `cause` chain — is a PostgreSQL driver
 * error carrying SQLSTATE `code`.
 *
 * Replaces the former Prisma error-code checks (P2002 unique, P2025 not-found,
 * P2004 constraint). Drizzle's node-postgres driver wraps failures in a
 * `DrizzleQueryError` whose `.cause` is the raw `pg` `DatabaseError` (its
 * `.code` is the SQLSTATE), so we walk the `cause` chain rather than reading
 * `.code` off the top-level error. Duck-typed, so the lightweight error fixtures
 * unit tests throw (a plain object with `code`) match too.
 */
export function isPgError(error: unknown, code: string): boolean {
  for (let current: unknown = error; isRecord(current); current = current['cause']) {
    if (current['code'] === code) {
      return true;
    }
  }
  return false;
}
