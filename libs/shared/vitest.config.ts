import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/shared',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    // Coverage is collected only in CI (GitHub sets CI=true) so local and
    // pre-commit runs stay fast; the CI "Unit tests" job uploads coverage/.
    coverage: {
      enabled: !!process.env.CI,
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      reportsDirectory: '../../coverage/shared',
    },
  },
});
