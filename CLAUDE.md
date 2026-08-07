# Meeting Room Booking — repository guide for AI agents

Nx monorepo: `apps/backend` (NestJS on Fastify), `apps/frontend` (Next.js),
`libs/shared` (`@office/shared`, imported by both). Domain: office room booking;
the office time zone is Europe/Kyiv — **store UTC, render in the viewer's zone**.

## Load the matching skill before starting
Task-scoped skills live in `.claude/skills/` (index: `.claude/skills/README.md`).
Read the relevant `SKILL.md` first instead of re-deriving the conventions:

| Task | Skill |
| --- | --- |
| App/feature code (backend module, frontend route/hook, shared contract) | `implementing-a-feature` |
| Unit / integration / Playwright tests | `testing` |
| Drizzle schema or a migration | `database-migrations` |
| Commit message, branch name, PR | `commits-and-prs` |
| README / `/docs` / an ADR / comment style | `documentation` |
| `.github/workflows` or `.github/actions` | `ci-workflows` |
| Add a dependency, bump a base image, suppress a finding | `dependencies-and-images` |
| Review a diff or PR | `code-review` |

## Non-negotiables (full detail lives in the skills)
- Strict TS, **no `any`**; Biome is the only formatter/linter (`npm run format`).
- Conventional Commits enforced by `scripts/lint-commit-msg.sh` (git hook + CI);
  never bypass a real failure with `--no-verify`.
- Never weaken a security gate to make it pass; every GitHub action is SHA-pinned.
- Never hand-edit `package-lock.json` or an applied
  `apps/backend/drizzle/**` migration (or its `meta/` journal).

## Setup & commands
The Node version is pinned in `.nvmrc`; the local stack runs via `docker compose`.
First-run steps and the full command list are in `CONTRIBUTING.md`.
