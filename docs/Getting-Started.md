# Getting Started

New to the project? This page takes you from a fresh clone to a running app.
There are two ways to run it — pick one:

| Path | Best for | Hot reload | Command |
| --- | --- | --- | --- |
| **A. Fully in Docker** | A first look, demos, prod-like runs | ❌ | `docker compose up --build` |
| **B. Dev mode** | Day-to-day development | ✅ | `nx serve` (see below) |

---

## ✅ Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| **Node.js** | `>= 20` | Managed via [`nvm`](https://github.com/nvm-sh/nvm) is recommended (`nvm install 20 && nvm use 20`) |
| **npm** | bundled with Node | Used for install & scripts |
| **Docker** + **Docker Compose** | recent | Required for Path A; Path B still uses it for Postgres |
| **git** | any | Hooks are wired up automatically on `npm install` |
| **gitleaks** *(optional)* | latest | `brew install gitleaks` — enables the pre-commit secret scan (skipped cleanly if absent) |

> 💡 The repo pins TypeScript and toolchain versions in `package.json`; you do
> **not** need a global TypeScript/Nx install — everything runs through
> `npx nx …` and local dev-dependencies.

## 0. Clone

```bash
git clone <your-repo-url> meeting-room-booking
cd meeting-room-booking
```

---

## Path A — Fully in Docker (production-like)

The fastest way to see the whole thing, including monitoring and logging.

```bash
docker compose up --build
```

That's it. On a fresh clone this brings up the app, database, proxy, Prometheus,
Grafana, and the ELK stack. The **backend container applies Prisma migrations
(`migrate deploy`) and the idempotent demo seed on every start** — no manual DB
steps required.

Then open:

| Surface | URL |
| --- | --- |
| App | http://localhost |
| Swagger | http://localhost/api/docs |
| Grafana (`admin`/`admin`) | http://localhost:3002 |
| Prometheus | http://localhost:9090 |
| Kibana (logs) | http://localhost:5601 |

Jump to [Verify it works](#-verify-it-works).

---

## Path B — Dev mode (hot reload)

Runs the frontend and backend as local Nx dev servers, with only **Postgres** in
Docker. This is the recommended day-to-day setup.

### 1. Install dependencies

```bash
npm install
```

`postinstall` generates the Prisma client, and `prepare` wires the git hooks
(`git config core.hooksPath .githooks`) — so hooks are active immediately.

### 2. Configure environment

```bash
cp .env.example .env      # the defaults work out of the box for local dev
```

The committed defaults are safe for local development — you only need to change
values for the [scenarios noted below](#-when-do-i-need-to-change-anything). See
the [full variable reference](#-environment-variables) further down.

### 3. Start the database

```bash
docker compose up -d db   # Postgres only; also creates the booking_test database
```

### 4. Migrate & seed

```bash
npm run prisma:migrate    # apply migrations to the dev database
npm run seed              # rooms, two test users, and demo bookings
```

> These two run **once** by hand in dev mode. (In Docker/Path A the backend does
> `migrate deploy` + seed automatically on every start.)

### 5. Run the apps

Two terminals (or one with `&`):

```bash
npx nx serve backend      # http://localhost:3001/api  (Swagger at /api/docs)
npx nx serve frontend     # http://localhost:3000
```

In dev mode the frontend talks **directly** to `http://localhost:3001/api`
(`NEXT_PUBLIC_API_URL`), which is why CORS is enabled outside production.

---

## 🔎 Verify it works

1. Open the app and log in with a seeded account:

   | Email | Password |
   | --- | --- |
   | `test1@office.dev` | `password123` |
   | `test2@office.dev` | `password123` |

2. Open a room, click a free slot, and create a booking.
3. Check it shows up on **My bookings**.

Seeded rooms (name · floor · capacity): **Small** (1 · 4), **Large** (1 · 12),
**Skype booth** (2 · 1), **Brainstorm** (2 · 6), **Boardroom** (3 · 16),
**Focus** (3 · 2).

---

## 🔧 Environment variables

All variables live in `.env` (copy from `.env.example`). No secrets are
committed; Docker Compose supplies sane defaults for local use.

### PostgreSQL

| Variable | Required | Default | Description |
| --- | :---: | --- | --- |
| `POSTGRES_USER` | ✅ | `postgres` | DB user for the Compose `db` service & Prisma |
| `POSTGRES_PASSWORD` | ✅ | `postgres` | DB password |
| `POSTGRES_DB` | ✅ | `booking` | Primary database name |

### Backend

| Variable | Required | Default | Description |
| --- | :---: | --- | --- |
| `DATABASE_URL` | ✅ | `postgresql://postgres:postgres@localhost:5432/booking?schema=public` | Prisma connection string (dev points at the dockerized DB on `localhost:5432`) |
| `JWT_SECRET` | ✅ | `change-me-in-production` | **Change in any real deployment.** Signs session JWTs |
| `JWT_TTL` | ⬜ | `24h` | Token lifetime (`ms`-style string, e.g. `24h`, `30m`) |
| `APP_URL` | ⬜ | `http://localhost:3000` | Base URL used to build the email-confirmation link written to the server log |
| `COOKIE_SECURE` | ⬜ | `false` | Set `true` when served over HTTPS (adds `Secure` to the session cookie) |
| `PORT` | ⬜ | `3001` | Backend listen port |
| `LOG_LEVEL` | ⬜ | `info` | Pino log level (`trace`…`fatal`) |
| `THROTTLE_TTL_MS` | ⬜ | `60000` | Rate-limit window for `/auth/*`, in ms |
| `THROTTLE_LIMIT` | ⬜ | `10` | Max `/auth/*` requests per window per IP |
| `NOTIFY_BEFORE_MINUTES` | ⬜ | `10` | Minutes before a booking ends to raise the "ends soon" notification |

### Frontend

| Variable | Required | Default | Description |
| --- | :---: | --- | --- |
| `NEXT_PUBLIC_API_URL` | ✅ | `http://localhost:3001/api` | API base. **Baked in at build time.** In Docker it is `/api` (same origin behind Traefik) |

### Tests

| Variable | Required | Default | Description |
| --- | :---: | --- | --- |
| `TEST_DATABASE_URL` | ⬜ | `postgresql://postgres:postgres@localhost:5432/booking_test?schema=public` | Separate DB for integration tests (auto-created by `infra/db/init-test-db.sql`) |

### 💡 When do I need to change anything?

- **Serving over HTTPS** → set `COOKIE_SECURE=true`.
- **Any non-local deployment** → set a strong `JWT_SECRET`.
- **Different DB host/creds** → update `DATABASE_URL` (and `POSTGRES_*`).
- **Frontend calling a non-default API** → rebuild with a new `NEXT_PUBLIC_API_URL`
  (it's compiled into the bundle, not read at runtime).

---

## 🧪 Tests & quality gates

```bash
npm test                             # unit tests, all projects (alias for `nx run-many -t test`)
npx nx run-many -t lint,test,build   # lint (Biome) + unit tests + builds, everything
npm run lint                         # Biome check (lint + format) across the repo
npm run format                       # Biome: auto-fix lint + format in place
npm run test:integration             # supertest API tests (needs `docker compose up -d db`)
npm run test:e2e                     # Playwright browser e2e (needs the full stack on :80)
```

- **Integration tests** run against the separate `booking_test` database and
  apply migrations before the suite.
- **E2E** drives the real app in a browser; bring the stack up first:
  `docker compose up -d --wait db backend frontend traefik`.

## 🪝 Git hooks (automatic, fast)

Activated by the `prepare` script on `npm install`. They finish in seconds and
do only fast, staged-file work — everything heavier is left to CI:

- **pre-commit** — Biome format + safe lint fixes on staged files (re-staged),
  a trailing-whitespace / conflict-marker check, and a staged-only secret scan
  with gitleaks (when installed).
- **commit-msg** — validates the subject against **Conventional Commits**.

Bypass in a pinch with `git commit --no-verify` — CI re-runs every check, so
nothing slips through. See **[Code Style](Code-Style)** for the rules.

---

## 🩹 Troubleshooting

| Symptom | Likely cause & fix |
| --- | --- |
| `ECONNREFUSED :5432` on backend start | Postgres isn't up → `docker compose up -d db` |
| Prisma client type errors after pulling | Regenerate: `npm install` (runs `prisma generate`) or `npx prisma generate --schema apps/backend/prisma/schema.prisma` |
| Login works but booking returns **403** | Email not confirmed — open the confirmation link printed in the **backend log**, or use a seeded (pre-confirmed) account |
| Frontend calls the wrong API URL | `NEXT_PUBLIC_API_URL` is baked at build time — change `.env` and restart/rebuild the frontend |
| Port already in use (`3000`/`3001`/`5432`) | Another instance is running — stop it, or change `PORT` / the Compose port mapping |
| `node: command not found` | Node isn't on `PATH` — select it via your version manager first (e.g. `nvm use 20`) |
| Commit rejected by `commit-msg` hook | Subject isn't Conventional Commits — see [Code Style → Commits](Code-Style#-commit-messages-conventional-commits) |

Next: **[Architecture](Architecture)** · **[Code Style](Code-Style)**
