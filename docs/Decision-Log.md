# Decision Log (ADRs)

This page records the **architecture & engineering decisions** behind Meeting
Room Booking — *why* each significant choice was made, what alternatives were
weighed, and the trade-offs accepted. It follows the lightweight
[ADR](https://adr.github.io/) (Architecture Decision Record) convention.

**Status legend:** ✅ Accepted · 🔄 Superseded · 🕓 Proposed · ⛔ Deprecated
**Dates** reflect when the decision was adopted. Newer decisions may supersede
older ones — superseding is noted inline rather than by deleting history.

> How to add one: append the next `ADR-NNNN`, fill in Context / Decision /
> Alternatives / Consequences, and add a row to the index. Never rewrite an
> accepted record — supersede it with a new one.

## Index

| # | Decision | Status | Date |
| --- | --- | :---: | --- |
| [0001](#adr-0001--nx-integrated-monorepo-with-a-shared-contracts-library) | Nx integrated monorepo + shared contracts lib | ✅ | 2026-01 |
| [0002](#adr-0002--nestjs-on-the-fastify-adapter) | NestJS on the Fastify adapter | ✅ | 2026-01 |
| [0003](#adr-0003--postgresql--prisma-7-engine-free-pg-adapter) | PostgreSQL + Prisma 7 (engine-free) | 🔄 | 2026-01 |
| [0004](#adr-0004--prevent-double-booking-with-a-database-exclude-constraint) | No-overlap via DB `EXCLUDE` constraint | ✅ | 2026-01 |
| [0005](#adr-0005--store-utc-validate-in-office-time-render-in-the-viewers-zone) | UTC storage / office-time rules / viewer-time render | ✅ | 2026-01 |
| [0006](#adr-0006--weekly-recurring-bookings-as-a-materialized-series) | Recurring bookings as a materialized series | ✅ | 2026-07 |
| [0007](#adr-0007--jwt-in-an-httponly-cookie) | JWT in an HttpOnly cookie | ✅ | 2026-07 |
| [0008](#adr-0008--route-protection-in-middleware-data-via-tanstack-query) | Middleware route-guard; client data fetching | ✅ | 2026-07 |
| [0009](#adr-0009--bcryptjs-instead-of-native-bcrypt) | `bcryptjs` instead of native `bcrypt` | ✅ | 2026-07 |
| [0010](#adr-0010--nginx-as-the-single-entry-point) | Nginx single entry point | 🔄 | 2026-07 |
| [0011](#adr-0011--prometheus--grafana-elk-without-logstash) | Prometheus/Grafana; ELK without Logstash | ✅ | 2026-07 |
| [0012](#adr-0012--biome-replaces-eslint--prettier) | Biome replaces ESLint + Prettier | ✅ | 2026-07 |
| [0013](#adr-0013--track-latest-major-deps-pin-typescript-to-603) | Latest major deps; pin TypeScript 6.0.3 | ✅ | 2026-07 |
| [0014](#adr-0014--why-not-what-commenting-standard) | "Why, not what" commenting standard | ✅ | 2026-07 |
| [0015](#adr-0015--five-stage-devsecops-ci-build-once-guarded-scanners) | 5-stage DevSecOps CI | ✅ | 2026-08-01 |
| [0016](#adr-0016--snyk-gates-on-critical-severity-only) | Snyk gates on **critical** only | ✅ | 2026-08-02 |
| [0017](#adr-0017--protect-main-gate-merges-on-all-ci-checks) | Protect `main`; gate merges on CI | ✅ | 2026-08-02 |
| [0018](#adr-0018--trunk-based-flow-with-a-develop-mirror) | Trunk-based flow, `develop` mirror | ✅ | 2026-08-02 |
| [0019](#adr-0019--docs-in-docs-mirrored-to-the-github-wiki) | `/docs` mirrored to the GitHub Wiki | ✅ | 2026-08-02 |
| [0020](#adr-0020--traefik-replaces-nginx-as-the-single-entry-point) | Traefik replaces Nginx as the edge | 🔄 | 2026-08-02 |
| [0021](#adr-0021--build-after-source-analysis-ci-stage-reorder) | Build after source analysis (CI reorder) | ✅ | 2026-08-03 |
| [0022](#adr-0022--migrate-from-prisma-7-to-drizzle-orm) | Migrate from Prisma 7 to Drizzle ORM | ✅ | 2026-08-07 |
| [0023](#adr-0023--nginx-replaces-traefik-as-the-single-entry-point) | Nginx replaces Traefik as the edge | ✅ | 2026-08-07 |

---

## Architecture & platform

### ADR-0001 · Nx integrated monorepo with a shared contracts library
**Status:** ✅ Accepted · **Date:** 2026-01

**Context.** Frontend and backend share domain types (DTOs), validation rules,
and constants. Keeping them in separate repos invites API/UI drift.
**Decision.** One **Nx integrated** monorepo (`apps/backend`, `apps/frontend`,
`libs/shared`). Both apps import the *same* DTO interfaces and domain constants
from `@office/shared`. TypeScript `strict` everywhere; `any` banned.
**Alternatives.** Polyrepo (drift, duplicated types); npm workspaces without Nx
(no task graph/caching); Turborepo (Nx's Nest/Next generators fit better).
**Consequences.** Single install, cached `lint/test/build` task graph, one
source of truth for the wire contract. Cost: Nx learning curve, one big repo.

### ADR-0002 · NestJS on the Fastify adapter
**Status:** ✅ Accepted · **Date:** 2026-01

**Context.** Need a structured Node API (DI, guards, pipes, Swagger) with good
throughput.
**Decision.** **NestJS 11** on `@nestjs/platform-fastify` instead of the default
Express adapter. `trustProxy` is set on the `FastifyAdapter`; Swagger UI is
served via `@fastify/static`.
**Alternatives.** NestJS + Express (default, slightly slower, looser typing);
bare Fastify (loses Nest's DI/module structure).
**Consequences.** Same adapter-agnostic Nest pipeline, plus a side benefit — the
HTTP metrics interceptor records exact status codes (201/204) and Fastify route
patterns (low-cardinality metric labels). Cost: a few Express-only libs don't
apply.

### ADR-0003 · PostgreSQL + Prisma 7 (engine-free, pg adapter)
**Status:** 🔄 The ORM choice is superseded by [ADR-0022](#adr-0022--migrate-from-prisma-7-to-drizzle-orm) (the PostgreSQL 16 choice stands) · **Date:** 2026-01

**Context.** Relational data (users, rooms, bookings) with strong constraints
and range queries.
**Decision.** **PostgreSQL 16** with **Prisma 7**. Prisma 7 is engine-free — the
connection is supplied at runtime by the `pg` **driver adapter** (in
`PrismaService`) and by `prisma.config.ts` for the CLI, so the URL no longer
lives in `schema.prisma`. Raw-SQL migrations are used where Prisma's DSL can't
express a constraint (see [ADR-0004](#adr-0004--prevent-double-booking-with-a-database-exclude-constraint)).
**Alternatives.** TypeORM/Drizzle (less mature migration story for our needs);
Prisma with the legacy query engine binary (heavier images).
**Consequences.** Type-safe queries, smaller runtime, but some Postgres features
(GiST exclusion, functional unique index) require hand-written SQL migrations.

### ADR-0004 · Prevent double-booking with a database EXCLUDE constraint
**Status:** ✅ Accepted · **Date:** 2026-01

**Context.** Two users must never book the same room for overlapping times —
even under concurrency.
**Decision.** Enforce it **in the database**, not the app, via
`EXCLUDE USING gist ("roomId" WITH =, tstzrange("startsAt","endsAt") WITH &&)`
(`btree_gist`, raw-SQL migration). Ranges are half-open, so touching slots don't
overlap. Inserts are a single atomic statement; the loser's `23P01` error is
mapped to **HTTP 409**. There is **no pre-check `SELECT`**.
**Alternatives.** Application-level "check then insert" (racy — a TOCTOU window
lets two inserts both pass the check); advisory locks / serializable transactions
(more code, more contention).
**Consequences.** Race-free by construction; the rule lives in exactly one place.
Cost: overlap logic is in SQL, and the error-code→HTTP translation must be
maintained.

### ADR-0005 · Store UTC, validate in office time, render in the viewer's zone
**Status:** ✅ Accepted · **Date:** 2026-01

**Context.** The office runs on **Europe/Kyiv** working hours (09:00–19:00), but
employees may view the schedule from other time zones.
**Decision.** **Store** all instants as UTC (`timestamptz`); **validate** working
hours in office time on the server; put UTC ISO-8601 strings **on the wire**;
**render** every time in each viewer's own browser zone. A 10:00 Kyiv slot shows
as 09:00 in Berlin. Recurring series repeat at the same office **wall-clock**
time (DST-safe).
**Alternatives.** Store local office time (ambiguous across DST, breaks for
remote viewers); render everything in office time (confusing for remote staff).
**Consequences.** Correct across DST and geographies; the invariant "UTC in the
middle, convert only at the edges" must be respected in all new code.

### ADR-0006 · Weekly recurring bookings as a materialized series
**Status:** ✅ Accepted · **Date:** 2026-07

**Context.** Users want a booking to repeat weekly; cancellation must offer "just
this one" vs "this and all later".
**Decision.** `repeatWeeks` (1–12) **materializes one row per week** at the same
office-zone wall-clock time, all sharing a `seriesId`, inserted in **one
transaction** (all-or-nothing). Each occurrence is protected by the same overlap
constraint. `DELETE ?scope=series` removes this and every later occurrence.
**Alternatives.** Store a recurrence rule (RRULE) and expand on read (complex
overlap checking, harder cancellation semantics).
**Consequences.** Simple, queryable rows; each occurrence conflicts
independently. Cost: a bounded cap (12) and more rows per series.

## Frontend & auth

### ADR-0007 · JWT in an HttpOnly cookie
**Status:** ✅ Accepted · **Date:** 2026-07

**Context.** Browser sessions need XSS-resistant token storage; tooling
(Swagger/curl/tests) needs header auth.
**Decision.** Login/register set `token` as `HttpOnly; SameSite=Lax; Path=/;
Max-Age=86400`, so JS never sees the JWT and XSS can't exfiltrate it;
`SameSite=Lax` doubles as CSRF protection. The guard **also** accepts
`Authorization: Bearer`. `COOKIE_SECURE=true` over TLS.
**Alternatives.** `localStorage` token (XSS-exfiltratable); cookie without
`SameSite` (CSRF-exposed).
**Consequences.** Strong browser posture + tooling compatibility. The frontend
caches only the non-sensitive profile as a "logged-in" hint; a 401 clears it.

### ADR-0008 · Route protection in middleware; data via TanStack Query
**Status:** ✅ Accepted · **Date:** 2026-07

**Context.** Protected pages must not flash before an auth check; the schedule is
live data.
**Decision.** `src/middleware.ts` redirects anonymous requests to `/login` (and
logged-in visits away from `/login`) **before render**, checking cookie presence
and the JWT `exp` only — **signature verification stays on the backend** (secret
never leaves it), so a forged cookie still dies on the first API call (401). Data
is fetched **client-side with TanStack Query** (schedule refetches every 30 s).
**Alternatives.** Client-side guard (skeleton flash); full SSR of the schedule (a
backend round-trip per navigation for data that's immediately refetched anyway).
**Consequences.** No flash, no double-fetch; SSR benefits (SEO) are irrelevant
for an authed internal tool.

### ADR-0009 · `bcryptjs` instead of native `bcrypt`
**Status:** ✅ Accepted · **Date:** 2026-07

**Context.** Password hashing in Alpine-based Docker images.
**Decision.** Use **`bcryptjs`** (pure JS) — identical hash format to `bcrypt`,
no native build step in Alpine.
**Alternatives.** Native `bcrypt` (needs a build toolchain in the image);
`argon2` (stronger, but heavier native dep — overkill here).
**Consequences.** Simpler, smaller images; marginally slower hashing (acceptable
at this scale).

## Observability & runtime

### ADR-0010 · Nginx as the single entry point
**Status:** 🔄 Superseded by [ADR-0020](#adr-0020--traefik-replaces-nginx-as-the-single-entry-point) · **Date:** 2026-07

**Context.** One origin for the app avoids CORS in production and hides internal
ports.
**Decision.** **Nginx on `:80`** is the only published app port: `/api/*` →
backend, everything else → frontend. Backend/frontend ports are **not** published
to the host. `GET /health` and `GET /metrics` bypass the `/api` prefix and JWT.
**Alternatives.** Publish each service's port (CORS, larger attack surface);
Traefik/Caddy (Nginx is sufficient and familiar).
**Consequences.** Same-origin cookies, one surface. Monitoring UIs
(Grafana/Prometheus/Kibana) publish their **own** ports directly — see
[ADR-0011](#adr-0011--prometheus--grafana-elk-without-logstash).

### ADR-0011 · Prometheus + Grafana; ELK without Logstash
**Status:** ✅ Accepted · **Date:** 2026-07

**Context.** Need metrics dashboards and centralized logs for a Dockerized stack.
**Decision.** **Metrics:** a Nest interceptor exposes `http_request_*` histograms
+ business counters at `/metrics`; Prometheus scrapes every 10 s; Grafana ships a
pre-provisioned dashboard. **Logs:** the app emits structured pino JSON;
**Filebeat → Elasticsearch → Kibana** with **no Logstash** — Filebeat's
`decode_json_fields` does the parsing, so a JVM-heavy transform hop adds nothing.
Grafana/Prometheus/Kibana publish their own ports (avoids Nginx sub-path config).
**Alternatives.** Full ELK with Logstash (idle JVM cost); Loki/Tempo (fine, but
ELK was chosen for Kibana's Discover UX).
**Consequences.** Immediate dashboards + searchable logs on `docker compose up`;
Elasticsearch runs single-node with security disabled (local tooling only).

## Engineering process & tooling

### ADR-0012 · Biome replaces ESLint + Prettier
**Status:** ✅ Accepted · **Date:** 2026-07

**Context.** ESLint + Prettier is two tools, two configs, and slow.
**Decision.** **Biome** is the single formatter + linter (`biome.json`). Repo-wide
`noExplicitAny` and `noUnusedVariables` are errors. Backend overrides
(`apps/backend/**`) relax rules that fight NestJS decorator metadata / DI (e.g.
`useImportType: off`) — these are **load-bearing**.
**Alternatives.** Keep ESLint + Prettier (slower, more config); oxlint (younger
ecosystem at decision time).
**Consequences.** One fast tool, identical local/CI results. Cost: smaller rule
ecosystem than ESLint; the backend overrides must not be removed casually.

### ADR-0013 · Track latest major deps; pin TypeScript to 6.0.3
**Status:** ✅ Accepted · **Date:** 2026-07

**Context.** Staying current (Next 16, React 19, Prisma 7, Tailwind 4, Nx 23)
reduces future upgrade debt; but bleeding-edge tooling can break the chain.
**Decision.** Adopt the latest majors across the stack — **except** pin
**TypeScript to `6.0.3`**: the TS 7 native compiler broke tooling
(Nx/SWC/type-checking) at upgrade time.
**Alternatives.** Conservative LTS-only pins (more upgrade debt later); take TS 7
too (broken build).
**Consequences.** Modern stack, one deliberate exception documented so nobody
"helpfully" bumps TypeScript and breaks CI.

### ADR-0014 · "Why, not what" commenting standard
**Status:** ✅ Accepted · **Date:** 2026-07

**Context.** The codebase is heavily commented; without a rule that invites
either noise or cargo-culted deletion.
**Decision.** A comment must explain **why** (a constraint, trade-off, or
non-obvious edge case), never restate **what** the code already says. On cleanup,
strip only **name-echoing** comments; keep the explanatory ones — they're the
project's institutional memory.
**Alternatives.** "Self-documenting code, no comments" (loses hard-won context);
no standard (inconsistent density).
**Consequences.** High-signal comments; reviewers apply one clear test. See
[Code Style](Code-Style#-comments-explain-why-not-what).

### ADR-0015 · Five-stage DevSecOps CI (build once, guarded scanners)
**Status:** ✅ Accepted · **Date:** 2026-08-01

**Context.** Need security + quality gates without doubling build time or
breaking fork PRs.
**Decision.** `.github/workflows/ci.yml` runs five sequential stages —
**① Sanity & Deps** (Biome, gitleaks, commit-lint, Snyk SCA) → **② Build & Unit**
(both Docker images pushed to GHCR `:sha`, Vitest coverage) → **③ Deep Analysis**
(SonarQube, CodeQL, Snyk Container) → **④ Integration** → **⑤ E2E**. The image is
**built once** in Stage 2 and pulled downstream (no rebuilds). External scanners
are **token-guarded**: they enforce when their secret is present and skip green
otherwise, so fork PRs stay healthy.
**Alternatives.** One giant job (no parallelism, rebuilds); scanners that hard-fail
without secrets (breaks forks).
**Consequences.** Strong gates, no double builds. Local `.githooks` mirror the
fast checks; a `--no-verify` bypass is still caught in Stage 1. DAST (ZAP) is a
separate nightly workflow.

### ADR-0016 · Snyk gates on CRITICAL severity only
**Status:** ✅ Accepted · **Date:** 2026-08-02 · **Supersedes** the initial `high` threshold in [ADR-0015](#adr-0015--five-stage-devsecops-ci-build-once-guarded-scanners)

**Context.** Newly-disclosed **high**-severity advisories in *transitive* deps
began failing CI with no clean fix — e.g. `nanoid` (via `next › postcss`), fixed
only in nanoid 5.x, which is ESM-only and incompatible with postcss 8. This
blocked all merges for issues with no actionable upgrade.
**Decision.** Both Snyk gates (SCA + Container) run `--severity-threshold=critical`.
High/medium/low are still **scanned and logged** but no longer **block** the
build. Team policy: gate CI on critical only; triage lower severities out-of-band.
**Alternatives.** Per-vuln `.snyk` ignores (endless churn as new CVEs land);
pinning incompatible transitive versions (breaks the build); keep `high`
(permanently red on un-fixable transitives).
**Consequences.** CI unblocks on un-fixable high-sev transitives; the residual
risk is accepted and reviewed manually. Revisit if critical volume rises.

### ADR-0017 · Protect main; gate merges on all CI checks
**Status:** ✅ Accepted · **Date:** 2026-08-02

**Context.** `main` is the release trunk; nothing broken should land.
**Decision.** Classic branch protection on `main`: **all 11 CI checks required**,
**pull-request required** (0 approvals — solo maintainer), **`enforce_admins`
on** (applies to the owner too), force-push & deletion blocked. Direct pushes to
`main` are rejected — everything goes through a PR.
**Alternatives.** No protection (broken `main` risk); required reviews ≥1 (a solo
maintainer can't approve their own PR — self-lock); admin bypass left on (defeats
"CI must pass").
**Consequences.** `main` stays releasable. Trade-off: if a required check is
stuck (e.g. an external-scanner outage), even the admin is blocked until the
setting is relaxed — an accepted cost of a real gate. See
[Code Style → Branching](Code-Style#-branching-strategy).

### ADR-0018 · Trunk-based flow with a develop mirror
**Status:** ✅ Accepted · **Date:** 2026-08-02

**Context.** The repo carries both `main` and `develop`; the team wanted a clear,
low-ceremony flow.
**Decision.** **Trunk-based / GitHub Flow**: `main` is the always-releasable
trunk; short-lived `<type>/<desc>` branches merge via PR gated by CI
([ADR-0017](#adr-0017--protect-main-gate-merges-on-all-ci-checks)). `develop`
serves as an optional integration **mirror**, fast-forwarded from `main` (it is
kept an ancestor of `main`, not ahead of it — the inverse of classic GitFlow).
**Alternatives.** Full GitFlow (release/hotfix branches — heavy for this team);
`main`-only (loses the shared integration branch some workflows expect).
**Consequences.** Simple mental model; `develop` == `main` after each sync. Note:
CI currently triggers on `main` + PRs, so `develop` has no run of its own.

### ADR-0019 · Docs in `/docs`, mirrored to the GitHub Wiki
**Status:** ✅ Accepted · **Date:** 2026-08-02

**Context.** Documentation should be reviewable in PRs *and* browsable as a wiki,
without maintaining two copies.
**Decision.** Markdown lives in **`/docs`** (single source of truth, versioned
with the code). `scripts/publish-wiki.sh` mirrors it into the GitHub Wiki repo,
rewriting `](../…)` links to absolute `blob/main` URLs so they resolve in the
flat wiki. `.github/workflows/publish-wiki.yml` runs the sync on every push to
`main` touching `docs/**`. This very page is part of that set.
**Alternatives.** Author directly in the Wiki (not PR-reviewable, drifts from
code); docs site generator (Docusaurus/MkDocs — more infra than needed).
**Consequences.** One source, PR-reviewed, auto-published. One-time setup: the
wiki's first page must be created via the UI before the backing repo exists.

### ADR-0021 · Build after source analysis (CI stage reorder)
**Status:** ✅ Accepted · **Date:** 2026-08-03 · **Refines** the stage order in [ADR-0015](#adr-0015--five-stage-devsecops-ci-build-once-guarded-scanners)

**Context.** ADR-0015's original order built the Docker images in Stage 2, in
parallel with the unit tests and *before* the source analysis (SonarQube, CodeQL).
So a lint slip, a failing unit test, or a SAST/quality finding still paid for a
full image build and left a stray `:sha` image in GHCR (which the cleanup job then
has to prune).
**Decision.** Reorder into source-first, build-later: **① Sanity & Deps →
② Test & Analysis** (unit + CodeQL + SonarQube, all on the source) **→ ③ Build &
push images → ④ Container scan + Integration → ⑤ E2E**. The image is still built
**once** and reused by the container scan and E2E. gitleaks stays in CI as the
enforcement layer for a bypassed pre-commit hook — only the ordering changes.
**Alternatives.** Keep build in Stage 2 (fastest time-to-image, but wastes builds
on bad source); build after unit tests only, leaving SonarQube/CodeQL after build
(smaller change, less fail-fast); drop gitleaks from CI (rejected — the pre-commit
hook is bypassable, so CI is the real gate).
**Consequences.** No image is built unless every source gate is green, so failed
runs cost less and leave no stray GHCR images. Trade-off: on a fully-green run the
image appears a little later, because the build now waits for the quality gate.

## Networking & edge

### ADR-0020 · Traefik replaces Nginx as the single entry point
**Status:** 🔄 Superseded by [ADR-0023](#adr-0023--nginx-replaces-traefik-as-the-single-entry-point) · **Date:** 2026-08-02 · **Supersedes** [ADR-0010](#adr-0010--nginx-as-the-single-entry-point)

**Context.** ADR-0010 put **Nginx** on `:80` as the one published app port, with
routes hand-maintained in `nginx.conf`. That works, but the upstream list is
static, there's no first-class metrics feed for the Prometheus/Grafana stack we
already run ([ADR-0011](#adr-0011--prometheus--grafana-elk-without-logstash)), and
TLS would be one more bespoke block to hand-roll.
**Decision.** **Traefik v3** is the edge on `:80` (and `:443`, templated). Routing
moves off a config file onto **Docker-provider labels** on the `backend` and
`frontend` services — `/api` (prefix kept, matching the Nest global prefix) beats
a `/` catch-all by router priority. Traefik reads the Docker API through a
**read-only `tecnativa/docker-socket-proxy`** on an `internal` network, so it
never mounts `/var/run/docker.sock` itself. Native **Prometheus metrics** feed a
provisioned Grafana dashboard; the dashboard UI binds to `127.0.0.1:8080`.
Let's Encrypt is configured but commented, ready for a real domain. The external
contract is unchanged: same `:80`, same two routes, same-origin cookies, and
`GET /health` + `/metrics` still bypass the proxy.
**Alternatives.** Keep Nginx (static upstreams, no built-in metrics/ACME — the
ADR-0010 choice, now outgrown); Caddy (great auto-TLS, weaker dynamic
service-discovery for Docker); mount the raw Docker socket into Traefik (simpler,
but hands the edge container root-equivalent host access).
**Consequences.** Adding a routed service is now a label, not a proxy edit; metrics
and a TLS path come for free. Cost: two extra containers (Traefik + socket-proxy)
and a Traefik-specific mental model. The socket-proxy is the only container that
touches the Docker socket, and it does so read-only on an isolated network.

### ADR-0022 · Migrate from Prisma 7 to Drizzle ORM
**Status:** ✅ Accepted · **Date:** 2026-08-07
**Supersedes the ORM half of** [ADR-0003](#adr-0003--postgresql--prisma-7-engine-free-pg-adapter).

**Context.** The data layer was Prisma 7 (engine-free, `pg` driver adapter). Prisma
still ships a generated client (a `postinstall` / Docker-build `prisma generate`
step) and, at runtime in the container, needed the `prisma` CLI installed purely to
run `migrate deploy` on start-up — extra tooling and image weight for a small
three-table schema.
**Decision.** Replace Prisma with **Drizzle ORM** over the **`drizzle-orm/node-postgres`**
driver (a `pg` `Pool`). The schema is `apps/backend/src/db/schema.ts`; a `DatabaseModule`
exposes one pooled Drizzle client through a `DRIZZLE` injection token. Reads use
Drizzle's **relational query API** (`db.query.*` with `with`), the closest analogue
to Prisma's `include`. Migrations are `drizzle-kit`-generated SQL under
`apps/backend/drizzle/`; the `btree_gist` EXCLUDE constraint ([ADR-0004](#adr-0004--prevent-double-booking-with-a-database-exclude-constraint))
stays a hand-written **custom** migration (Drizzle can't model EXCLUDE), while the
`lower(email)` functional unique index — which Prisma couldn't model and needed raw
SQL — now lives in the schema. A small bundled programmatic migrator
(`src/db/migrate.ts`) applies migrations at container start, so the runtime image
ships **no** migration CLI (and drops the `openssl`/engine baggage).
**Alternatives.** Keep Prisma (works, but the generated client + runtime CLI are
overhead at this size); Drizzle **core** select/join API (more explicit SQL, but
more churn versus Prisma's `include`, so relational queries were chosen); TypeORM
(heavier, decorator-based, weaker inference).
**Consequences.** No client-generation step; a lighter, CLI-free runtime image;
a plain-TypeScript schema; the `lower(email)` guarantee moves from raw SQL into the
schema. Driver errors are now raw `pg` `DatabaseError`s (SQLSTATE), which Drizzle
wraps in a `DrizzleQueryError` — error handling walks the `cause` chain for
`23505`/`23P01` rather than reading Prisma error codes. Because the migrations were
regenerated fresh, a database previously Prisma-migrated (e.g. a local dev volume)
must be reset once (`docker compose down -v`); CI and the integration suite always
start from an empty database, so they are unaffected.

### ADR-0023 · Nginx replaces Traefik as the single entry point
**Status:** ✅ Accepted · **Date:** 2026-08-07 · **Supersedes** [ADR-0020](#adr-0020--traefik-replaces-nginx-as-the-single-entry-point)

**Context.** ADR-0020 moved the edge from a hand-written Nginx config to Traefik v3,
trading a static upstream list for Docker-label routing, a native metrics feed, and
a templated ACME path. That convenience cost **two extra containers** — Traefik plus
a `tecnativa/docker-socket-proxy` sidecar — and put routing behind a Traefik-specific
model (labels, router priority, static + dynamic config files). For a fixed two-route
topology (`/api` + a catch-all) that changes ~never, the dynamic service-discovery
machinery earns little, and exposing the Docker API to the edge — even read-only, even
on an isolated network — is attack surface we'd rather not run.
**Decision.** Return the edge to **Nginx** (`infra/nginx/nginx.conf`) on `:80`, as in
[ADR-0010](#adr-0010--nginx-as-the-single-entry-point): `/api/*` → backend (prefix
kept, matching the Nest global prefix), everything else → the frontend, both routes
declared directly in the file. Traefik's `secure-headers` middleware is ported to
`add_header` directives (`X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`), so the header posture is unchanged. The socket-proxy sidecar, its
`internal` network, and the ACME volume are removed. The external contract is
identical: same `:80`, same two routes, same-origin cookie, and `GET /health` +
`/metrics` still bypass the proxy.
**Alternatives.** Keep Traefik (dynamic discovery + native metrics + templated TLS,
but two containers and Docker-socket exposure for a topology that never changes — the
ADR-0020 choice, not worth its cost here); Caddy (auto-TLS, but another runtime we
don't otherwise use).
**Consequences.** Two fewer containers and no Docker socket anywhere in the stack;
routing is one readable file again. Cost: adding a routed service is a config edit,
not a label (fine at this size), and the edge loses its native Prometheus feed — so
the Traefik Grafana dashboard and its scrape job are dropped (backend `/metrics` and
the app dashboard are untouched). TLS returns to a hand-rolled concern: Nginx has no
built-in ACME, so a real deployment terminates TLS with a mounted cert or a certbot
sidecar. Net: the ADR-0010 posture, with the header hardening from the Traefik era
kept.

---

See also: **[Architecture](Architecture)** · **[Code Style](Code-Style)** · **[Home](Home)**
