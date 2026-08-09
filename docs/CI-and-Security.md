# CI & security

The CI pipeline shape and the security policies that gate it. Authoritative
source: `.github/workflows/ci.yml` and
[ADR-0015](Decision-Log#adr-0015--five-stage-devsecops-ci-build-once-guarded-scanners) /
[ADR-0016](Decision-Log#adr-0016--snyk-gates-on-critical-severity-only). If a doc
ever drifts from `ci.yml`, `ci.yml` wins.

## Pipeline shape

Five sequential stages — **source first, build later**, so broken source never
costs a Docker build (ADR-0015):

1. **Sanity & Deps** — Biome lint · gitleaks · commit-lint · Snyk SCA
2. **Test & Analysis** — Vitest coverage · CodeQL · SonarQube (all on the source)
3. **Build** — build **and push** both images to GHCR `:sha`, once, after Stage 2
4. **Container scan & Integration** — Snyk container scan (both images) · API + Postgres
5. **E2E** — Playwright against the pulled Docker stack

The image is **built once in Stage 3, pushed to GHCR `:sha`, and pulled**
downstream by the container scan and E2E — no rebuilds.

## Pipeline rules

- **Pin every action to a full commit SHA** (with a `# vX` comment). No moving
  tags — resolve with `gh api repos/<owner>/<repo>/commits/<tag> -q .sha`.
- **Least privilege:** top-level `permissions: contents: read`; a job widens its
  own scope only where needed — `packages: write` on the build job (push to GHCR),
  `packages: read` on the container scan and E2E (pull), `security-events: write`
  on the CodeQL job.
- **`timeout-minutes` on every job** — a stuck external call fails fast.
- **A missing secret fails trusted runs.** External scanners run when their secret
  is set and skip **only** on fork PRs; otherwise they error out — so fork PRs stay
  green while a trusted run is never silently unguarded.
- **The release gate is branch protection, not a pipeline job.** `main` is PR-only
  with all CI checks required and `enforce_admins` on (ADR-0017); nothing broken
  merges. There is no separate publish/release job.
- **CodeQL findings → the Security tab** as SARIF (uploaded by `codeql-action/analyze`).

### Job names are load-bearing
A job's `name:` **is** its branch-protection required-check context. Renaming a
job breaks that required check and can block merges — if a rename is unavoidable,
update the required-status-checks list in the same change.

## Dependencies

- Install normally (`npm install <pkg>` / `-D`) and commit the updated
  `package-lock.json` — **never hand-edit it**. The root manifest drives the whole
  Nx workspace.
- **License policy** — this is an MIT project, so avoid strong-copyleft / SSPL
  (`GPL-*`, `AGPL-*`, `LGPL-*`, `SSPL-1.0`) in **production** dependencies; choose a
  differently-licensed package. A convention today, not a CI gate.
- **Vulnerabilities:** the Snyk SCA and container gates fail on **CRITICAL** only
  (ADR-0016); high / medium / low are scanned and logged but non-blocking and
  triaged out-of-band. Fix a critical by upgrading the dependency.

## Docker images

- Base images are pinned to an exact tag (`node:26.5.1-alpine`) that matches
  `.nvmrc`. Bump the backend Dockerfile, frontend Dockerfile, and `.nvmrc`
  together.
- **Runtime images strip npm / corepack** (both Dockerfiles). Keep it — npm's
  vendored dependencies are a recurring source of image CVEs and the runtime never
  runs npm.
- The container scan gates on **CRITICAL** only
  ([ADR-0016](Decision-Log#adr-0016--snyk-gates-on-critical-severity-only)) and
  covers **both** images, each against its own Dockerfile.

### After a base-image bump — verify locally
```bash
docker build -f apps/backend/Dockerfile -t mrb-backend:scan .
docker build -f apps/frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=/api -t mrb-frontend:scan .
trivy image --scanners vuln --severity CRITICAL mrb-backend:scan   # and mrb-frontend:scan
```
Expect **0 CRITICAL** per image before pushing.

## Suppressing a finding — last resort

There is no `.snyk` file today, and that is the preferred state. Add an ignore
only after a base-image bump, a dependency bump, and a transitive pin have all
failed; every entry must carry an `expires` date and a written reason. Never raise
a threshold or move a scan off the CI gate just to go green.

## Connecting this to a new repository

Reusing this scaffold on a fresh repo takes a short one-time checklist:

1. **Branch protection** (ADR-0017) — on `main`, require all CI checks, require a
   pull request, enable `enforce_admins`, and block force-pushes and deletions.
2. **Secrets** — `SNYK_TOKEN`, `SONAR_TOKEN`, `SONAR_HOST_URL`
   (`https://sonarcloud.io`). Without them the Snyk / Sonar gates fail on trusted
   runs by design.
3. **SonarCloud** — create the project, then set `sonar.projectKey` /
   `sonar.organization` in `sonar-project.properties` to match it (the only two
   repo-specific lines in the file).
4. **Wiki** — save one initial page on the repo's Wiki tab so `publish-wiki` can
   mirror `/docs`.

Everything else is already repo-relative: images publish to
`ghcr.io/<owner>/<repo>-{backend,frontend}` and the GHCR cleanup prunes those same
names — no per-repo edits needed.

---

See also: **[Decision Log](Decision-Log)** · **[Code Style](Code-Style)** · **[Working on the code](Contributing-Code)**
