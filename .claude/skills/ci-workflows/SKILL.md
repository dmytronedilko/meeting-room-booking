---
name: ci-workflows
description: >-
  Use when editing anything under .github/workflows or .github/actions — adding a
  job, bumping an action, changing the build/scan/publish flow, or touching the
  release gate. Encodes the rules this pipeline settled on: SHA-pinned actions,
  least-privilege permissions, per-job timeouts, scan-before-publish, publish.needs
  as the real release gate, fail-on-missing-secret, SARIF to the Security tab.
  Does NOT cover license/Snyk policy for dependencies (see dependencies-and-images)
  or commit rules (see commits-and-prs).
---

# Working on CI workflows

Authoritative design: `.github/workflows/ci.yml` + `docs/Decision-Log.md`
ADR-0015/0016/0022. `CONTRIBUTING.md` / `Code-Style.md` summarize the pipeline; if
they ever drift from `ci.yml`, `ci.yml` wins.

## Non-negotiable rules
- **Pin every action to a full commit SHA + `# vX` comment.** No moving tags.
  Resolve with `gh api repos/<owner>/<repo>/commits/<tag> -q .sha` and record how.
- **Least privilege:** top-level `permissions: contents: read`; a job widens its
  own scope only where needed (`packages: write` on publish; `security-events:
  write` on the SARIF uploads; `id-token`/`attestations: write` on publish).
- **`timeout-minutes` on every job.**
- **Build once → scan → publish.** Images build with `load: true` (no push), are
  exported as the `images` artifact, scanned by `container_scan` (**both** images),
  and only `publish` pushes — with `if: github.event_name == 'push'`.
- **`publish.needs` is the real release gate.** Branch protection does **not**
  apply to `push`/tag events, so every job that must block a release goes in
  `publish.needs` (build, container_scan, unit, integration, e2e, codeql, secrets,
  snyk_sca, license_check, iac_scan). A `pull_request`-only job must **not** be
  added — a skipped need skips publish. To gate **PRs** on a new job, also add its
  `name:` to the branch-protection required-status-checks (an admin/settings
  change); `publish.needs` gates releases, not PRs.
- **A missing secret fails on trusted runs.** Pattern: run when set; skip **only**
  on a fork PR (`github.event.pull_request.head.repo.fork`); otherwise `::error::`
  + `exit 1`.
- **Findings → SARIF** via `github/codeql-action/upload-sarif` (reuse the
  already-pinned CodeQL SHA), one `category` per file.
- **`buildx cache-to` writes on `main` only** (`github.ref == 'refs/heads/main'`).
  PR writes churn the 10 GB GHA cache and evict the shared npm cache (symptom:
  every node job's `setup-node-ci` step doubles, ~30s → ~75s).

## Job names are load-bearing
A job's `name:` **is** its branch-protection required-check context. **Renaming a
job breaks that required check** — the `Build & push images` → `Build images`
rename stranded a required check and blocked all merges. If a rename is
unavoidable, update the required-status-checks list in the same change.

## Validate + test without merging
- `actionlint .github/workflows/*.yml` before committing (`brew install
  actionlint`; keep `shellcheck` installed so `run:` blocks are linted too).
- Push-only paths (publish, lowercase image names, version tags, attestations)
  never run on a PR. Exercise them with a throwaway prerelease tag:
  `git tag v0.0.1-rcN && git push origin v0.0.1-rcN` → watch the `publish` job →
  delete the tag + the rc package versions. `:latest` is gated off prerelease
  tags, so an rc won't move it.

## The other workflows
`nightly-security.yml` (unfiltered Snyk + full-history gitleaks, cron), `dast.yml`
(ZAP baseline), `ghcr-cleanup.yml` (prune old versions), `publish-wiki.yml`. Node
setup is the `./.github/actions/setup-node-ci` composite (reads `.nvmrc`).

## Failure modes
- `@v4` instead of a SHA → fails review and defeats the pin.
- A `pull_request`-only job in `publish.needs` → publish skipped on push.
- Renaming a job → its required check never reports → PRs unmergeable.
