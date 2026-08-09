import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/booking_test?schema=public';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/backend-e2e',
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2021',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  resolve: {
    alias: {
      '@office/shared': resolve(__dirname, '../../libs/shared/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['e2e/**/*.e2e-spec.ts'],
    globalSetup: ['e2e/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    reporters: ['default'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'integration-test-secret',
      THROTTLE_LIMIT: '1000',
      LOG_LEVEL: 'silent',
      // The suite drives the notification scan explicitly; no background timer.
      DISABLE_NOTIFICATIONS_SCHEDULER: 'true',
      NOTIFY_BEFORE_MINUTES: '10',
    },
  },
});
