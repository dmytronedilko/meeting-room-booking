import { execSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * Applies Prisma migrations to the dedicated test database before the
 * integration suite runs. Requires the dockerized Postgres to be up
 * (`docker compose up -d db`), which auto-creates `booking_test`.
 */
export default function globalSetup(): void {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/booking_test?schema=public';
  const workspaceRoot = join(__dirname, '../../..');

  execSync('npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma', {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
