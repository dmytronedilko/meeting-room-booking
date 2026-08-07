---
name: database-migrations
description: >-
  Use when changing the Drizzle schema (apps/backend/src/db/schema.ts), creating
  or reviewing a migration under apps/backend/drizzle, or reasoning about whether
  a migration is safe against a live database. Covers the generation-free Drizzle
  + node-postgres setup, the drizzle-kit generate + hand-written custom-SQL
  pattern, and how integration tests consume the schema. Does NOT cover
  application code (see implementing-a-feature) or the CI Postgres service wiring
  (see ci-workflows).
---

# Database & migrations

## Drizzle over node-postgres (no client generation)
- No generated client and no query-engine binary. `DatabaseModule`
  (`apps/backend/src/app/db/database.module.ts`) builds one `pg` `Pool` from
  `DATABASE_URL` plus a schema-bound Drizzle client, exposed via the `DRIZZLE`
  injection token (`@Inject(DRIZZLE) db: DrizzleDB`). `drizzle.config.ts` (repo
  root) points drizzle-kit at the schema and `DATABASE_URL`.
- Schema is `apps/backend/src/db/schema.ts` (plain TypeScript). Conventions:
  PK `uuid('id').primaryKey().defaultRandom()`; timestamps via the local
  `timestamptz` helper (`withTimezone`, `precision: 3`, **`mode: 'date'`** — keeps
  JS `Date`s at the app layer); explicit `index(...)`/`uniqueIndex(...)` on query
  paths; keep SQL names as-is (`pgTable('User', …)`); define `relations(...)` so
  the relational query API (`db.query.*` with `with`) works.

## Migrations
- Generate: `npm run db:generate` (`drizzle-kit generate`) after a schema edit →
  new SQL + `meta/` journal under `apps/backend/drizzle/`. For SQL Drizzle can't
  model, `npx drizzle-kit generate --custom --name <snake_desc>` writes an empty
  migration to hand-fill.
- Apply: `npm run db:migrate` (the programmatic migrator `src/db/migrate.ts`). CI
  and the integration `global-setup.ts` migrate a clean `booking_test`; the Docker
  entrypoint runs the bundled `migrate.js` at start.
- **Migrations are immutable.** Once committed/applied, never edit a migration
  file or its `meta/` snapshot — generate a new one. Editing a migration whose
  hash the migrator already recorded breaks it locally, in CI, and against prod.

## Custom raw-SQL migrations (the pattern that matters here)
Some invariants can't be expressed in the Drizzle schema and are **hand-written
SQL** in a `--custom` migration:
- **No-overlap:** `CREATE EXTENSION btree_gist;` + `EXCLUDE USING gist ("roomId"
  WITH =, tstzrange("startsAt","endsAt") WITH &&)` — half-open ranges, so touching
  bookings don't collide (`0001_booking_no_overlap.sql`, ADR-0004). Drizzle has no
  EXCLUDE builder.
- **Case-insensitive email uniqueness** now lives in the schema as a functional
  unique index on `lower(email)` (drizzle-kit emits it), so it is **not** a custom
  migration. Only reach for `--custom` when the schema genuinely can't model it
  (extensions, EXCLUDE, triggers). Comment **why** at the top of a custom
  migration (match `0001_booking_no_overlap.sql`).

## Driver errors (no Prisma error codes)
Drizzle wraps a failed query in a `DrizzleQueryError` whose `.cause` is the raw
`pg` `DatabaseError` (its `.code` is the SQLSTATE). Use `isPgError(error, code)`
from `apps/backend/src/db/pg-errors.ts` (it walks the `cause` chain): `23505`
unique → 409, `23P01` exclusion → 409. A delete that matched nothing returns an
empty `.returning()` (no error) — check length for not-found.

## Unsafe against a live DB — flag in review
- Dropping/renaming a column or table, or narrowing a type, with data present.
- Adding a `NOT NULL` column without a default/backfill.
- Adding a `UNIQUE`/`EXCLUDE` constraint existing rows would violate.
- A destructive step with no reverse — prefer expand → migrate → contract.
(The repo has no written reversibility policy — see the open-questions list.)

## How tests use the schema
Integration tests migrate a clean `booking_test` in `global-setup.ts` before
running (see testing) and exercise the real constraints (e.g. the overlap
`EXCLUDE`), so a schema change usually needs an integration test.

## Failure modes
- Editing an applied migration (or its `meta/` snapshot) → migrator hash mismatch.
- Reading `error.code` directly instead of `isPgError` → misses the SQLSTATE on
  `DrizzleQueryError.cause`, so unique/exclusion violations surface as 500s.
- Using a `--custom` migration for something the schema can model (e.g. a
  functional index) instead of expressing it in `schema.ts`.
- Migrating a database that predates the Drizzle journal → "relation already
  exists"; reset the dev DB once (`docker compose down -v`).
