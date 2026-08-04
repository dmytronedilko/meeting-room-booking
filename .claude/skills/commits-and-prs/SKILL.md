---
name: commits-and-prs
description: >-
  Use when writing a commit message, naming a branch, opening or merging a pull
  request, or splitting a large change in this repo. The commit rules come from
  scripts/lint-commit-msg.sh (enforced by the .githooks/commit-msg hook and the
  CI "Commit messages" job). Does NOT cover what the CI pipeline checks (see
  ci-workflows) or review criteria (see code-review).
---

# Commits & PRs

## Commit subjects (Conventional Commits)
`scripts/lint-commit-msg.sh` is the **single source of truth** — run by the
`.githooks/commit-msg` hook and re-run in CI, so a `--no-verify` bypass is still
caught.

- Format: `<type>(<scope>)<!>: <description>` — imperative, no trailing period.
- **Allowed types** (from the script):
  `feat fix docs style refactor perf test build ci chore revert release`.
  `release` is repo-specific (`release: v1.2.0`).
- **Scope is optional** and matches `[a-z0-9._/-]+` — lowercase. The script does
  **not** restrict it to Nx project names. Lived scopes: `backend`, `frontend`,
  `bookings`, `auth`, `deps`, `infra`, `docker`.
- Git-generated subjects (`Merge …`, `Revert …`, `fixup!`, `squash!`, `amend!`)
  pass as-is.

Good: `feat(bookings): add weekly recurring series` · `fix: correct Europe/Kyiv
DST boundary` · `ci: gate publish on CodeQL`.
Rejected: `updated stuff` (no type) · `feature: …` (`feature` isn't a type) ·
`Fix: bug.` (capitalized + trailing period).

## Branches
Off `main`, named `<type>/<short-kebab-desc>`, reusing the commit types:
`feat/recurring-bookings`, `ci/rebalance-quality-gates`, `fix/dst-rendering`.
(`develop` exists but is **vestigial** — ~40 commits behind `main`; branch off
`main`.)

## PRs
- Open into `main`; the full CI pipeline must be green (see ci-workflows).
- **Merged with a merge commit** (`Merge pull request #N …`) — the lived history
  for every PR here. (`CONTRIBUTING.md` says "prefer squash"; actual practice is
  merge — noted in the open-questions list.)
- Description: what changed + why, and call out any required-status-check or
  repo-setting change a reviewer must make by hand.
- Split a large change into a sequence of focused, individually-green PRs — one
  Conventional-Commit subject each (see the `ci/*` PR chain #1–#9).

## Never
- `git commit --no-verify` to dodge a real failure. The hooks (Biome, whitespace,
  gitleaks, commit-msg) are all re-run in CI, so nothing slips through — bypass
  only for a genuinely safe, understood reason.

## Failure modes
- `feature:` / `chore(Deps):` / capitalized subject → hook + CI reject.
- `--no-verify` past a gitleaks hit → the CI Secrets job still fails the PR.
