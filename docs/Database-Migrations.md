# Database & migrations

Drizzle ORM over `node-postgres`, with SQL migrations under
`apps/backend/drizzle/`. For where DB code is consumed see
[Working on the code](Contributing-Code); the no-overlap constraint is
[ADR-0004](Decision-Log#adr-0004--prevent-double-booking-with-a-database-exclude-constraint).

## Drizzle over node-postgres (no client generation)

- No generated client and no query-engine binary. `DatabaseModule`
  (`apps/backend/src/app/db/database.module.ts`) builds one `pg` `Pool` from
  `DATABASE_URL` plus a schema-bound Drizzle client, exposed via the `DRIZZLE`
  injection token (`@Inject(DRIZZLE) db: DrizzleDB`). `drizzle.config.ts` (repo
  root) points drizzle-kit at the schema and `DATABASE_URL`.
- The schema is `apps/backend/src/db/schema.ts` (plain TypeScript). Conventions:
  PK `uuid('id').primaryKey().defaultRandom()`; timestamps via the local
  `timestamptz` helper (`withTimezone`, `precision: 3`, **`mode: 'date'`** — keeps
  JS `Date`s at the app layer); explicit `index(...)` / `uniqueIndex(...)` on
  query paths; define `relations(...)` so the relational query API (`db.query.*`
  with `with`) works.

## Migrations

- **Generate:** `npm run db:generate` (`drizzle-kit generate`) after a schema
  edit → new SQL + `meta/` journal under `apps/backend/drizzle/`. For SQL Drizzle
  can't model, `npx drizzle-kit generate --custom --name <snake_desc>` writes an
  empty migration to hand-fill.
- **Apply:** `npm run db:migrate` (the programmatic migrator `src/db/migrate.ts`).
  CI and the integration `global-setup.ts` migrate a clean `booking_test`; the
  Docker entrypoint runs the bundled `migrate.js` at container start.
- **Migrations are immutable.** Once committed/applied, never edit a migration
  file or its `meta/` snapshot — generate a new one. Editing a migration whose
  hash the migrator already recorded breaks it locally, in CI, and against prod.

## Custom raw-SQL migrations

Some invariants can't be expressed in the Drizzle schema and are hand-written SQL
in a `--custom` migration:

- **No-overlap:** `CREATE EXTENSION btree_gist;` + `EXCLUDE USING gist ("roomId"
  WITH =, tstzrange("startsAt","endsAt") WITH &&)` — half-open ranges, so touching
  bookings don't collide (`0001_booking_no_overlap.sql`,
  [ADR-0004](Decision-Log#adr-0004--prevent-double-booking-with-a-database-exclude-constraint)).
  Drizzle has no EXCLUDE builder.
- **Case-insensitive email uniqueness** lives in the schema as a functional unique
  index on `lower(email)` (drizzle-kit emits it), so it is **not** a custom
  migration. Reach for `--custom` only when the schema genuinely can't model it
  (extensions, EXCLUDE, triggers), and comment **why** at the top of the file.

## Driver errors (SQLSTATE)

A failed query surfaces as a `DrizzleQueryError` whose `.cause` is the raw `pg`
`DatabaseError` (its `.code` is the SQLSTATE). Use `isPgError(error, code)` from
`apps/backend/src/db/pg-errors.ts` — it walks the `cause` chain: `23505` (unique)
→ 409, `23P01` (exclusion) → 409. A delete that matched nothing returns an empty
`.returning()` (no error) — check the length for not-found.

## Unsafe against a live database — flag in review

- Dropping or renaming a column or table, or narrowing a type, with data present.
- Adding a `NOT NULL` column without a default / backfill.
- Adding a `UNIQUE` / `EXCLUDE` constraint that existing rows would violate.
- A destructive step with no reverse — prefer expand → migrate → contract.

Integration tests migrate a clean `booking_test` before running and exercise the
real constraints (e.g. the overlap `EXCLUDE`), so a schema change usually needs an
integration test.

---

See also: **[Working on the code](Contributing-Code)** · **[Decision Log](Decision-Log)**
