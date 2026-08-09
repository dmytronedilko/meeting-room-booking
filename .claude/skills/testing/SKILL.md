---
name: testing
description: >-
  Use when writing, running, or debugging tests here, or when a change needs test
  coverage: Vitest unit tests (per Nx project), the backend API integration suite
  in apps/backend/e2e (supertest + a real Postgres), or the Playwright browser
  e2e in the root /e2e against the docker-compose stack. Covers the three tiers,
  the e2e naming trap, how to run one test, and how CI runs them. Does NOT cover
  Drizzle migration authoring (see database-migrations) or CI job wiring (see
  ci-workflows).
---

# Testing

Three tiers. **Naming trap:** `apps/backend/e2e/*.e2e-spec.ts` is the **API
integration** suite (supertest, no browser); the root `/e2e` is the **Playwright
browser** suite. "e2e" means different things by directory.

## 1. Unit — Vitest, per project
- Files: `*.spec.ts` next to the code (e.g. `libs/shared/src/lib/intervals.spec.ts`).
- Run all: `npm test` (= `nx run-many -t test`). One project: `npx nx test
  backend` (or `frontend`, `shared`). One file: `npx vitest run --config
  apps/backend/vitest.config.ts <path.spec.ts>`.
- Coverage: v8 → `coverage/<project>/lcov.info` (on in CI via `CI=true`), fed to
  SonarQube. **No numeric threshold is pinned in the repo** — any gate lives in
  the SonarQube quality gate (PR-only). Don't invent a %.

## 2. Backend integration — supertest + Postgres
- Config: `apps/backend/vitest.integration.config.ts`. Files:
  `apps/backend/e2e/**/*.e2e-spec.ts`. `globalSetup: e2e/global-setup.ts` runs
  the Drizzle migrator against `TEST_DATABASE_URL` (the `booking_test` DB)
  before the suite; `fileParallelism: false`.
- Pattern: boot the app via `Test.createTestingModule`, drive it with
  `request(app.getHttpServer())`. **No factory library** — set up state through
  the real API (or the seed), not by inserting rows directly.
- Run: `docker compose up -d db` first, then `npm run test:integration`
  (= `nx run backend:test-integration`).

## 3. Browser e2e — Playwright, chromium only
- Config: `playwright.config.ts`, `testDir: ./e2e`. Needs the full stack on :80
  (Nginx): `docker compose up -d --wait db backend frontend nginx`, then
  `npm run test:e2e`. `E2E_BASE_URL` overrides the base (default `http://localhost`).
- CI: `retries: 2`, `workers: 1`, list+html reporters. Only **chromium** is
  installed — don't add firefox/webkit specs without installing the browser.

## Reproducing CI locally
CI builds the images, `docker load`s them, and brings the stack up with the same
`docker compose up --wait …` command as tier 3. The integration Postgres in CI is
a service container with the same `booking_test` DB and `TEST_DATABASE_URL`.

## Failure modes
- A supertest test placed under root `/e2e` (Playwright) — or a browser test
  under `apps/backend/e2e` — won't run in the intended job.
- `npm run test:integration` without `docker compose up -d db` → `migrate deploy`
  in globalSetup can't connect.
- Treating coverage as a local build gate — it isn't; it's a Sonar PR gate.
