---
name: database-migrations
description: >-
  Use when changing the Prisma schema (apps/backend/prisma/schema.prisma),
  creating or reviewing a migration under apps/backend/prisma/migrations, or
  reasoning about whether a migration is safe against a live database. Covers the
  engine-free Prisma 7 setup, the hand-written raw-SQL migration pattern, and how
  integration tests consume the schema. Does NOT cover application code (see
  implementing-a-feature) or the CI Postgres service wiring (see ci-workflows).
---

# Database & migrations

## Prisma 7 is engine-free
- No query-engine binary; the connection comes from the `pg` driver adapter at
  runtime (`PrismaService`) and from `prisma.config.ts` for the CLI. **The URL is
  not in `schema.prisma`** — do not add a `url =` to the `datasource`.
- Schema conventions: PK `String @id @default(uuid()) @db.Uuid`; timestamps
  `DateTime @db.Timestamptz(3)`; explicit `@@index` on query paths.

## Migrations
- Create: `npx prisma migrate dev --name <snake_desc> --schema
  apps/backend/prisma/schema.prisma`. Files are named `<timestamp>_<snake_desc>`.
- Apply: `npm run prisma:migrate` (`prisma migrate deploy`). CI and the
  integration `global-setup.ts` run `migrate deploy` on a clean `booking_test`.
- **Migrations are immutable.** Once committed/applied, never edit a migration
  file — add a new one. Editing breaks `migrate deploy`'s checksum locally, in
  CI, and against prod.

## Raw-SQL migrations (the pattern that matters here)
Some invariants can't be expressed in the Prisma schema and are **hand-written
SQL** inside the generated migration:
- **No-overlap:** `CREATE EXTENSION btree_gist;` + `EXCLUDE USING gist ("roomId"
  WITH =, tstzrange("startsAt","endsAt") WITH &&)` — half-open ranges, so
  touching bookings don't collide (`20260101000001_booking_no_overlap`, ADR-0004).
- **Case-insensitive email uniqueness:** a functional unique index on
  `lower(email)` (`20260801000000_email_case_insensitive_unique`).
When you need a constraint/index/extension Prisma can't model, write the SQL into
the migration and comment **why** at the top (match those two files).

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
- Re-adding `url =` to the datasource → conflicts with the adapter/`prisma.config.ts`.
- Editing an applied migration → `migrate deploy` checksum failure in CI.
- Trying to express a `lower()`/`EXCLUDE` rule in the schema (impossible) instead
  of raw SQL.
