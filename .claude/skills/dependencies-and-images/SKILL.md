---
name: dependencies-and-images
description: >-
  Use when adding or updating an npm dependency, changing a Docker base image, or
  deciding whether a security finding may be suppressed here. Covers the license
  policy (an MIT-project convention), the Snyk severity threshold actually gated
  (CRITICAL), the rules for a .snyk ignore, and how to re-verify the container
  scan after a base-image bump. Does NOT cover general workflow edits (see
  ci-workflows) or application code (see implementing-a-feature).
---

# Dependencies & images

## Adding / updating an npm dependency
- Install normally (`npm install <pkg>` / `npm install -D <pkg>`) and commit the
  updated `package-lock.json` — never hand-edit it. The root manifest drives the
  whole Nx workspace.
- **License policy** — this is an MIT project, so avoid strong-copyleft / SSPL
  (`GPL-*`, `AGPL-*`, `LGPL-*`, `SSPL-1.0`) in **production** deps; choose a
  differently-licensed package. A convention today, not a CI gate.
- **Vulnerabilities** — `snyk_sca` gates on **CRITICAL** only (ADR-0016,
  `--severity-threshold=critical`); high/medium/low are scanned and logged but
  non-blocking, triaged out-of-band. Fix a critical by upgrading the dependency.

## Docker base images
- Pinned to an exact tag (`node:26.5.1-alpine`) that matches `.nvmrc`. Bump
  backend Dockerfile + frontend Dockerfile + `.nvmrc` together.
- **Runtime images strip npm/corepack** (both Dockerfiles `rm -rf …/npm
  …/corepack`). Keep it — npm's vendored deps (e.g. `tar`) are recurring image
  CVEs and the runtime never runs npm. Dropping this is exactly how
  CVE-2026-59873 reached the frontend image.
- `snyk_container` gates on **CRITICAL only** (ADR-0016) and scans **both** images,
  each against its own Dockerfile.

## After a base-image bump — verify the container scan
Reproduce locally; don't trust the run graph:
```bash
docker build -f apps/backend/Dockerfile -t mrb-backend:scan .
docker build -f apps/frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=/api -t mrb-frontend:scan .
trivy image --scanners vuln --severity CRITICAL mrb-backend:scan   # and mrb-frontend:scan
```
Trivy stands in for Snyk locally (same CVE IDs). Expect **0 CRITICAL** per image
before pushing.

## `.snyk` ignores — last resort only
There is **no `.snyk` file** today, and that is the preferred state. Add one only
after base-bump, dep-bump, and transitive-pin have all failed. Every entry **must**
carry an `expires` date and a written reason. Never raise a threshold, add
`--exclude-base-image-vulns`, or move a scan off the CI gate to go green
(code-review).

## Failure modes
- Hand-editing `package-lock.json` → `npm ci` mismatch fails CI.
- A GPL/AGPL production dep → swap the package (MIT-project convention).
- Bumping a base image without re-running the container scan → an unscanned CVE
  ships (the frontend regression).
