---
name: documentation
description: >-
  Use when writing or updating docs in this repo — README.md, the /docs pages
  (mirrored to the GitHub Wiki), an Architecture Decision Record in
  docs/Decision-Log.md, or when deciding whether a change needs an ADR versus a
  README edit. Also owns the repo's comment convention (explain why, not what).
  Does NOT cover code/test conventions (see implementing-a-feature) or commit
  subjects (see commits-and-prs).
---

# Documentation

## Where docs live
- **`/docs` is the single source of truth**, mirrored to the GitHub Wiki by
  `scripts/publish-wiki.sh` (auto via `.github/workflows/publish-wiki.yml`).
  Pages: `Architecture`, `Code-Style`, `Getting-Started`, `API-Reference`,
  `Decision-Log`, `Home`. Edit the `/docs` page, **never the Wiki directly**.
- `README.md` = pitch + first-run setup. `CONTRIBUTING.md` = the short
  contributor flow, linking into `/docs`.
- **Update docs in the same PR** as the behaviour change (`CONTRIBUTING.md`).

## ADR vs README
- **ADR** (`docs/Decision-Log.md`) — for an architecture/engineering **decision**
  with alternatives and trade-offs (a tech choice, the pipeline shape, a
  constraint). Never rewrite an accepted ADR — supersede it.
- **README / /docs edit** — for behaviour, setup, or API surface that changed but
  wasn't a new decision.

## ADR format (match existing entries exactly)
Append the next `ADR-NNNN`, add a row to the **Index** table at the top, and use
the four-part body:
```md
### ADR-00NN · <Short title>
**Status:** ✅ Accepted · **Date:** YYYY-MM-DD · **Supersedes/Refines** [ADR-00MM](#adr-00mm--...)

**Context.** <forces / problem>
**Decision.** <what we chose>
**Alternatives.** <what we rejected and why>
**Consequences.** <trade-offs accepted>
```
Status legend: ✅ Accepted · 🔄 Superseded · 🕓 Proposed · ⛔ Deprecated. When you
supersede one, flip its status **and** its Index cell to 🔄 and link the new ADR
(see ADR-0021→0022 for the exact pattern). Section anchors are GitHub-slugified
(` · ` becomes `--`).

## Comments: why, not what
This repo is **deliberately, heavily commented** — that's intentional, not clutter.
- ✅ explain a constraint / trade-off / non-obvious edge (see the comments in
  `.github/workflows/ci.yml` and `apps/backend/prisma/schema.prisma`).
- ❌ don't restate the next line (`// increment counter`).
- On cleanup, **strip only name-echoing comments**; keep every "why" comment —
  they're the project's institutional memory (ADR-0014).

## Failure modes
- Editing the Wiki directly → overwritten on the next `/docs` sync.
- A new ADR with no Index row, or reusing/rewriting an accepted number.
- A behaviour change merged without the matching `/docs` update.
