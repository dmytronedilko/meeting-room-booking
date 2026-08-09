---
name: ci-workflows
description: >-
  Use when editing anything under .github/workflows or .github/actions — adding a
  job, bumping an action, changing the five-stage build/scan flow, or reasoning
  about the release gate. Encodes the rules this pipeline settled on: SHA-pinned
  actions, least-privilege permissions, build-once-in-Stage-3, fail-on-missing-
  secret (fork-aware), and branch protection as the real release gate. Does NOT
  cover license/Snyk policy for dependencies (see dependencies-and-images) or
  commit rules (see commits-and-prs).
---

# Working on CI workflows

Authoritative design: `.github/workflows/ci.yml` + `docs/Decision-Log.md`
ADR-0015/0016/0017. `CONTRIBUTING.md` / `docs/Code-Style.md` /
`docs/CI-and-Security.md` summarize the pipeline; if they ever drift from
`ci.yml`, `ci.yml` wins.

## The pipeline (ADR-0015) — five sequential stages
Source first, build later, so broken source never costs a Docker build:
1. **Sanity & Deps** — `lint` (Biome) · `secrets` (gitleaks) · `commitlint` · `snyk_sca`
2. **Test & Analysis** — `unit` (+coverage) · `codeql` · `sonarqube`
3. **Build & push images** — `build`: both images → GHCR `:sha` (once, after Stage 2)
4. **Container scan & Integration** — `snyk_container` (both images) · `integration`
5. **E2E** — `e2e` (Playwright against the pulled stack)

The image is **built once in Stage 3, pushed to GHCR `:sha`, and pulled**
downstream by `snyk_container` and `e2e` — no rebuilds.

## Non-negotiable rules
- **Pin every action to a full commit SHA + `# vX` comment.** No moving tags.
  Resolve with `gh api repos/<owner>/<repo>/commits/<tag> -q .sha` and record how.
- **Least privilege:** top-level `permissions: contents: read`; a job widens its
  own scope only where needed — `packages: write` on `build` (push to GHCR),
  `packages: read` on `snyk_container` / `e2e` (pull), `security-events: write`
  on `codeql`.
- **`timeout-minutes` on every job** — a stuck external call fails fast, not after
  the default 6-hour ceiling.
- **A missing secret fails on trusted runs.** External scanners (`snyk_sca`,
  `snyk_container`, `sonarqube`) run when their secret is set and skip **only** on
  a fork PR (`github.event.pull_request.head.repo.fork`); otherwise `::error::` +
  `exit 1`. Never let a gate pass green just because its secret was absent.
- **The release gate is branch protection, not a pipeline job.** `main` is
  PR-only with all CI checks required and `enforce_admins` on (ADR-0017). There is
  no publish/release job — CI runs on push to `main` and on PRs, and the `build`
  job pushes the `:sha` images directly.
- **Snyk gates on CRITICAL only** (ADR-0016), both SCA and container.
- **CodeQL uploads SARIF to the Security tab** via `codeql-action/analyze`.

## Job names are load-bearing
A job's `name:` **is** its branch-protection required-check context. **Renaming a
job breaks that required check** — a `Build & push images` → `Build images` rename
would strand a required check and block all merges. If a rename is unavoidable,
update the required-status-checks list in the same change. To gate PRs on a **new**
job, add its `name:` to the branch-protection required-status-checks (an
admin/settings change) — otherwise it runs but does not block.

## Validate without merging
- `actionlint .github/workflows/*.yml` before committing (`brew install
  actionlint`; keep `shellcheck` installed so `run:` blocks are linted too).
- After a Dockerfile / base-image change, rebuild the image locally and
  `trivy image --scanners vuln --severity CRITICAL` it — expect 0 CRITICAL
  (see dependencies-and-images).

## The other workflows
`dast.yml` (ZAP baseline, nightly), `ghcr-cleanup.yml` (prune old GHCR versions),
`publish-wiki.yml` (mirror `/docs` to the Wiki). Each job calls
`actions/setup-node` directly with the pinned Node version.

## Failure modes
- `@v4` instead of a SHA → fails review and defeats the pin.
- A security gate that skips green on a missing secret during a trusted run.
- Renaming a job → its required check never reports → PRs unmergeable.
- A base-image bump merged without re-running the container scan (both images).
