---
name: code-review
description: >-
  Use when reviewing a diff, pull request, or proposed change in this repo —
  deciding what to flag and in what priority. Grounded in defects that have
  actually shipped here (a container-image CVE, a renamed job stranding a required
  check, a security gate passing on a missing secret). Enforces the non-negotiable
  CI/security rules and says what NOT to comment on. Does NOT cover authoring code
  (see implementing-a-feature) or the mechanics of workflow edits (see ci-workflows).
---

# Code review

Review in this order. Don't spend comments on anything a tool already fails on.

## 1. Security / supply-chain — never merge if violated
- **Never weaken a check to make it pass.** No raising a Snyk/Trivy threshold, no
  `--exclude-base-image-vulns`, no moving a scan off the publish path, no `.snyk`
  ignore without `expires` + a reason (dependencies-and-images). Precedent:
  CVE-2026-59873 was fixed by stripping npm from the frontend image, not by muting
  the gate.
- **No image reaches `publish` unscanned.** `container_scan` must gate it and must
  scan **both** images — a past bug scanned only the backend.
- **Actions pinned to a full SHA + version comment** (ci-workflows) — flag any
  `@vN` tag.
- **A missing secret must fail on trusted runs**, not pass with a `::notice::`.

## 2. Correctness in this domain
- Booking overlap is enforced by the DB `EXCLUDE` constraint; ranges are half-open
  (database-migrations). Times are UTC in the DB, viewer-TZ in the UI (ADR-0005).
- A migration that can't run against a live DB (database-migrations §unsafe).
- Backend: a type-only import of an injected provider — runtime DI break that
  Biome won't catch (implementing-a-feature).

## 3. Conventions with teeth
- Commit subjects valid per `scripts/lint-commit-msg.sh` (commits-and-prs).
- Shared shapes imported from `@office/shared`, not redeclared.
- Comments explain **why**, not **what** (documentation) — flag name-echoing
  noise, keep the rest.

## Do NOT comment on
- Formatting, quote style, semicolons, import order, unused variables, `any` —
  **Biome** (`error` level) and `tsc --strict` already fail the build on these. If
  Biome would autofix it, it is not a review comment.
- A coverage percentage — no repo threshold; SonarQube owns it (testing).

## Failure modes this catches
- A renamed CI job silently stranding a branch-protection required check.
- A gate that "passes" only because its secret happened to be absent.
- A base-image bump merged without re-running the container scan.
