# Working on the code

How application code is organized in this Nx monorepo, which targets to run, and
the TypeScript/Biome rules that actually bite. For commit / branch / PR
conventions see [Code Style](Code-Style); for the schema and migrations see
[Database & Migrations](Database-Migrations).

## Where code goes

- **`apps/backend`** — NestJS on Fastify. A feature is a folder
  `apps/backend/src/app/<feature>/` with `<feature>.module.ts`, `.controller.ts`,
  `.service.ts`, and a `dto/` directory (see `bookings/`, `auth/`, `rooms/`). Wire
  the module into `apps/backend/src/app/app.module.ts`. Global setup (validation
  pipe, `api` prefix, Swagger) lives in `apps/backend/src/app/setup.ts`, not
  `main.ts`. Pure domain rules (overlap, ownership) go in a testable
  `<feature>-rules.ts` module (see `bookings/booking-rules.ts` + `.spec.ts`);
  entity→response shaping goes in `<feature>.mapper.ts`. Keep the service thin
  over those.
- **`apps/frontend`** — Next.js App Router under `apps/frontend/src/app` (route
  groups like `(auth)` / `(app)`). Server calls go through the TanStack Query
  hooks in `apps/frontend/src/lib/hooks.ts` — don't scatter `fetch` across
  components. Forms use react-hook-form + zod (`zodResolver`).
- **`libs/shared` (`@office/shared`)** — cross-app request/response types
  (`types.ts`), domain constants (`constants.ts`), interval math (`intervals.ts`).
  Import them; never redeclare a DTO or inline a domain number (working hours,
  slot size). The barrel is `libs/shared/src/index.ts`; the path alias is in
  `tsconfig.base.json`.

## Running it

```bash
npx nx serve backend     # http://localhost:3001/api  (Swagger at /api/docs)
npx nx serve frontend    # http://localhost:3000
npx nx run-many -t lint,test,build   # the local gate
```

The backend builds with `@nx/webpack`; the seed is a second entry point
(`apps/backend/src/seed/seed.ts`, target `nx run backend:seed`).

## Conventions that bite

- **Strict TypeScript everywhere** (`tsconfig.base.json`). **No `any`** — Biome's
  `suspicious/noExplicitAny` is an error; use `unknown` and narrow.
  `noUnusedVariables` is an error too.
- **The backend Biome overrides are load-bearing** (`biome.json`,
  `apps/backend/**`): `useImportType: off`. NestJS DI reads decorator metadata at
  runtime, so an injected dependency must be a **value import**, not
  `import type` — don't "tidy" backend imports to type-only, or DI breaks at
  runtime.
- **Validation** = class-validator DTOs under `<feature>/dto/*.dto.ts`, enforced
  by the global `ValidationPipe`. Add a DTO; don't hand-parse the request body.
- **Errors** = throw the standard Nest HTTP exceptions (`NotFoundException`,
  `BadRequestException`, `UnauthorizedException`, `ForbiddenException`,
  `ConflictException`). A global filter renders the `{ statusCode, message, error }`
  envelope.
- **Time**: the office time zone is Europe/Kyiv; validate against it, **store
  UTC**, render in the viewer's zone
  ([ADR-0005](Decision-Log#adr-0005--store-utc-validate-in-office-time-render-in-the-viewers-zone)).
  Never persist local time.
- Formatting is Biome's job — `npm run format`, don't hand-format.

## Never hand-edit

- `apps/backend/drizzle/**` — applied migrations are immutable (see
  [Database & Migrations](Database-Migrations)).
- `package-lock.json` — change dependencies via `npm install` (see
  [CI & Security](CI-and-Security)).
- Generated output: `dist/`, `.next/`, `coverage/`, `.nx/` (Biome and Sonar
  already ignore these).

## Tests — three tiers

### 1. Unit (Vitest, per project)
`*.spec.ts` next to the code (e.g. `libs/shared/src/lib/intervals.spec.ts`). Run
all with `npm test` (= `nx run-many -t test`); one project with `npx nx test
backend`; one file with `npx vitest run --config apps/backend/vitest.config.ts
<path>`. Coverage (v8) feeds SonarQube; no numeric threshold is pinned in the repo.

### 2. Backend integration (supertest + Postgres)
Config `apps/backend/vitest.integration.config.ts`; files
`apps/backend/e2e/**/*.e2e-spec.ts`. `global-setup.ts` migrates a clean
`booking_test` database first. Boot the app via `Test.createTestingModule` and
drive it with supertest — set up state through the real API or the seed, not by
inserting rows. Run: `docker compose up -d db`, then `npm run test:integration`.

### 3. Browser e2e (Playwright, chromium)
Config `playwright.config.ts`, `testDir: ./e2e`. Needs the full stack on `:80`:
`docker compose up -d --wait db backend frontend nginx`, then `npm run test:e2e`.

> **Naming trap:** `apps/backend/e2e/*.e2e-spec.ts` is the **API integration**
> suite (supertest, no browser); the root `/e2e` is the **Playwright browser**
> suite. "e2e" means different things by directory.

---

See also: **[Code Style](Code-Style)** · **[Database & Migrations](Database-Migrations)** · **[CI & Security](CI-and-Security)**
