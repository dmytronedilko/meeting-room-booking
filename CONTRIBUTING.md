# Contributing

Thanks for helping improve **Meeting Room Booking**! This page is the short
version — the detailed guides live in [`/docs`](docs) (also published to the
project **Wiki**).

| I want to… | Go to |
| --- | --- |
| Get the app running locally | [Getting Started](docs/Getting-Started.md) |
| Understand the system | [Architecture](docs/Architecture.md) |
| Know the coding conventions | [Code Style](docs/Code-Style.md) |
| Look up an endpoint | [API Reference](docs/API-Reference.md) |

---

## 🚀 First-time setup

```bash
npm install                 # installs deps, wires git hooks
cp .env.example .env        # defaults work out of the box
docker compose up -d db     # Postgres (also creates booking_test)
npm run db:migrate          # apply migrations
npm run seed                # rooms + two test users + demo bookings
npx nx serve backend        # http://localhost:3001/api  (Swagger at /api/docs)
npx nx serve frontend       # http://localhost:3000
```

Full details, the `.env` reference, and troubleshooting are in
[**Getting Started**](docs/Getting-Started.md).

## 🌳 Branch, commit, PR

We use a **trunk-based** flow: `main` is always releasable, work happens on
short-lived branches merged via pull request.

1. **Branch off `main`**, named `<type>/<short-kebab-desc>` — e.g.
   `feat/recurring-bookings`, `fix/dst-rendering`, `docs/api-reference`.
2. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   `<type>(<optional scope>): <description>`.

   | Allowed types | |
   | --- | --- |
   | `feat` `fix` `docs` `style` `refactor` | `perf` `test` `build` `ci` `chore` `revert` `release` |

   ```text
   feat(bookings): add weekly recurring series
   fix: correct Europe/Kyiv DST boundary in slot rendering
   docs: expand the API reference
   ```

   The `commit-msg` git hook validates this locally; CI runs the **same**
   `scripts/lint-commit-msg.sh`, so a `--no-verify` bypass is still caught.
3. **Open a PR into `main`.** The full CI pipeline must be green to merge.
   Prefer **squash merge** so `main` keeps one clean Conventional-Commit subject.

See [**Code Style → Branching**](docs/Code-Style.md#-branching-strategy) for the
full model.

## ✅ Before you push

Git hooks (installed automatically on `npm install`) run fast staged-file checks
— Biome fixes, a whitespace/conflict-marker check, and a gitleaks secret scan.
Run the full local suite before opening a PR:

```bash
npm run lint                          # Biome (lint + format)
npm test                              # unit tests, all projects
npx nx run-many -t lint,test,build    # the full local gate
npm run test:integration              # supertest API tests (needs `docker compose up -d db`)
npm run test:e2e                      # Playwright (needs the stack up on :80)
```

### PR checklist

- [ ] `npm run lint` clean (or `npm run format` applied).
- [ ] `npm test` passes; new logic has unit tests.
- [ ] Integration / e2e updated if the API or a user flow changed.
- [ ] No `any`; shared shapes imported from `libs/shared`, not re-declared.
- [ ] Comments explain **why**, not **what** (see [Code Style](docs/Code-Style.md#-comments-explain-why-not-what)).
- [ ] Commit subjects follow Conventional Commits.
- [ ] Docs updated (`README.md` / `/docs`) if behaviour or setup changed.

## 🔎 What CI checks

Every push to `main` and every PR runs a **5-stage DevSecOps pipeline**
(`.github/workflows/ci.yml`): **① Sanity & Deps** (Biome, gitleaks, commit
messages, Snyk SCA) → **② Build & Unit** (Docker images + Vitest coverage) →
**③ Deep Analysis** (SonarQube, CodeQL, Snyk container scan) → **④ Integration**
→ **⑤ E2E**. External scanners enforce when their secret is present and skip
cleanly otherwise.

## 📚 Docs & the Wiki

`/docs` is the single source of truth; it's mirrored to the GitHub Wiki by
`scripts/publish-wiki.sh` (automatically on push via
`.github/workflows/publish-wiki.yml`, or run it by hand). When you change
behaviour, update the matching page under `/docs` in the same PR.

## 🔐 Security

Please **do not** open public issues for security vulnerabilities. Report them
privately to the maintainers (e.g. via GitHub's *Security → Report a
vulnerability*) so a fix can ship before disclosure.

---

By contributing, you agree that your contributions are licensed under the
project's **MIT License** (declared in [`package.json`](package.json)).
