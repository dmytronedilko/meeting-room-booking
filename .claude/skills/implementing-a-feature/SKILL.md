---
name: implementing-a-feature
description: >-
  Use when adding or changing application code in this Nx monorepo: a NestJS
  endpoint/service/module under apps/backend/src/app/<feature>, a Next.js
  route/component/hook under apps/frontend/src, or shared contracts/constants in
  libs/shared (@office/shared). Covers where code goes, which Nx targets to run,
  the TypeScript/Biome rules that actually bite here, and files that must never be
  hand-edited. Does NOT cover writing tests (see testing), the Drizzle schema or
  migrations (see database-migrations), or .github workflows (see ci-workflows).
---

# Implementing a feature

## Where code goes
- **`apps/backend`** — NestJS on Fastify. A feature is a folder
  `apps/backend/src/app/<feature>/` with `<feature>.module.ts`, `.controller.ts`,
  `.service.ts`, and a `dto/` dir (see `bookings/`, `auth/`, `rooms/`). Wire the
  module into `apps/backend/src/app/app.module.ts`. Global setup (pipes, `api`
  prefix, Swagger) lives in `apps/backend/src/app/setup.ts` — not `main.ts`.
  Pure domain rules (overlap/ownership) go in a testable `<feature>-rules.ts`
  module (see `bookings/booking-rules.ts` + `.spec.ts`); entity→response shaping
  goes in `<feature>.mapper.ts`. Keep the service thin over those.
- **`apps/frontend`** — Next.js App Router under `apps/frontend/src/app` (route
  groups like `(auth)`). Server calls go through the TanStack Query hooks in
  `apps/frontend/src/lib/hooks.ts` — don't scatter `fetch` in components. Forms
  use react-hook-form + zod (`zodResolver`).
- **`libs/shared` (`@office/shared`)** — cross-app request/response types
  (`types.ts`), domain constants (`constants.ts`), interval math (`intervals.ts`).
  Import them; never redeclare a DTO or inline a domain number (working hours,
  slot size). Barrel: `libs/shared/src/index.ts`; alias in `tsconfig.base.json`.

## Run it
```bash
npx nx serve backend     # http://localhost:3001/api  (Swagger at /api/docs)
npx nx serve frontend    # http://localhost:3000
npx nx run-many -t lint,test,build   # local gate (test tiers → see testing)
```
Backend builds with `@nx/webpack` (`generatePackageJson`); the seed is a second
entry point (`apps/backend/src/seed/seed.ts`, target `nx run backend:seed`).

## Conventions that actually bite
- **strict TS everywhere** (`tsconfig.base.json`). **No `any`** — Biome
  `suspicious/noExplicitAny` is `error`; use `unknown` + narrow.
  `noUnusedVariables` is `error` too.
- **The backend Biome overrides are load-bearing** (`biome.json`,
  `apps/backend/**`): `useImportType: off`. NestJS DI reads decorator metadata at
  runtime, so an injected dependency must be a **value import**, not
  `import type`. Do not "tidy" backend imports to type-only — Biome won't stop
  you and DI breaks at runtime.
- **Validation** = class-validator DTOs under `<feature>/dto/*.dto.ts`, enforced
  by the global `ValidationPipe` in `apps/backend/src/app/setup.ts`. Add a DTO;
  don't hand-parse the request body.
- **Errors** = throw the standard Nest HTTP exceptions already used here:
  `NotFoundException`, `BadRequestException`, `UnauthorizedException`,
  `ForbiddenException`, `ConflictException`. No custom error envelope.
- **Time**: office TZ is Europe/Kyiv; validate against it, **store UTC**, render
  in the viewer's zone (ADR-0005). Never persist local time.
- Formatting is Biome's job — `npm run format`, don't hand-format.

## Never hand-edit
- `apps/backend/drizzle/**` — applied migrations are immutable (database-migrations).
- `package-lock.json` — change deps via `npm install` (dependencies-and-images).
- Generated output: `dist/`, `.next/`, `coverage/`, `.nx/`, the generated Prisma
  client. Biome and Sonar already ignore these.

## Failure modes
- Type-only import of an injected provider in backend → runtime DI failure, **not**
  a compile error. Symptom: `Nest can't resolve dependencies of X`.
- Inlining `30`/`19`/limits instead of `libs/shared/constants.ts` → API/UI drift.
- Re-declaring a request/response shape instead of importing `@office/shared` →
  the PR checklist rejects it (`CONTRIBUTING.md`).
