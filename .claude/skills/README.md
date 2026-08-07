# Project skills

Task-scoped skills capturing how work is actually done in this repo, so sessions
don't re-derive the conventions. Each lives in `<skill>/SKILL.md`; the
`description` frontmatter decides when it fires.

| Skill | Fires when you're… |
| --- | --- |
| `implementing-a-feature` | adding/changing app code (backend module, frontend route/hook, `@office/shared`) |
| `testing` | writing/running Vitest unit, backend supertest integration, or Playwright e2e |
| `database-migrations` | changing the Drizzle schema or a migration, or judging migration safety |
| `commits-and-prs` | writing a commit subject, naming a branch, opening/merging a PR |
| `documentation` | editing README/`/docs`, writing an ADR, or applying the why-not-what comment rule |
| `ci-workflows` | editing `.github/workflows` or `.github/actions` |
| `dependencies-and-images` | adding a dependency, bumping a base image, judging a security suppression |
| `code-review` | reviewing a diff/PR — what to flag, in what order |

## Who owns overlapping topics (cross-reference, don't repeat)
- Comment style (why-not-what) → **documentation** (`implementing-a-feature`,
  `ci-workflows` link it).
- TypeScript / Biome in practice → **implementing-a-feature** (`code-review` links
  it: don't flag what Biome/`tsc` already enforce).
- CI/security gate rules (SHA pins, scan-before-publish, `publish.needs`,
  fail-on-missing-secret, SARIF, job-names-are-required-checks) → **ci-workflows**
  (`code-review`, `dependencies-and-images` link it).
- License / Snyk / `.snyk` policy → **dependencies-and-images** (`ci-workflows`,
  `code-review` link it).
- Migration safety → **database-migrations** (`testing`, `code-review` link it).
- Conventional Commits / `lint-commit-msg.sh` → **commits-and-prs** (`code-review`
  links it).

Distilled from: `CONTRIBUTING.md`, `docs/Code-Style.md`, `docs/Decision-Log.md`,
`biome.json`, `nx.json`, `apps/*/project.json`, `scripts/lint-commit-msg.sh`,
`.github/workflows/ci.yml`, `apps/backend/src/db/`, `apps/backend/drizzle/`.
