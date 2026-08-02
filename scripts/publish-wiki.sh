#!/bin/sh
#
# Publish the Markdown in /docs to this repository's GitHub Wiki.
#
# The wiki is a *separate* git repo (OWNER/REPO.wiki.git) whose page names are
# the file names (Home.md -> "Home", Getting-Started.md -> "Getting Started",
# and the magic _Sidebar.md / _Footer.md render on every page). This script
# clones that repo, copies every docs/*.md into it, and pushes if anything
# changed — so /docs stays the single source of truth and the wiki is a mirror.
#
# One transform is applied on the way in: links written as `](../path)` (which
# point at files elsewhere in THIS repo — e.g. ../README.md) are rewritten to
# absolute github.com blob URLs, because a relative `../` escapes the flat wiki
# repo and would 404. Wiki-internal links like `](Architecture)` are left alone.
#
# Usage:
#   sh scripts/publish-wiki.sh
#
# Environment overrides (all optional; sensible defaults derived from `origin`):
#   WIKI_REMOTE       git URL of the wiki repo (default: origin with .wiki.git)
#   WIKI_LINK_SLUG    OWNER/REPO used to build blob URLs (default: from origin)
#   WIKI_LINK_BRANCH  branch the blob URLs point at            (default: main)
#   GIT_AUTHOR_NAME / GIT_AUTHOR_EMAIL   commit identity (default: local config)
#
# In CI, set WIKI_REMOTE to a token URL, e.g.
#   https://x-access-token:${GITHUB_TOKEN}@github.com/OWNER/REPO.wiki.git
#
# Note: this is an additive mirror — it creates/updates pages but never deletes
# wiki pages, so hand-authored wiki pages are safe. The wiki must already exist
# (open the repo's Wiki tab and save one initial page); otherwise the clone
# fails with guidance below.

set -eu

# Repo root, regardless of where the script is invoked from.
SRC_ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
DOCS_PATH="$SRC_ROOT/docs"

LINK_BRANCH="${WIKI_LINK_BRANCH:-main}"

if [ ! -d "$DOCS_PATH" ]; then
  echo "✗ No docs/ directory at $DOCS_PATH" >&2
  exit 1
fi

origin_url=$(git -C "$SRC_ROOT" remote get-url origin 2>/dev/null || true)

# OWNER/REPO — for building absolute blob URLs. Overridable for CI.
slug="${WIKI_LINK_SLUG:-$(printf '%s' "$origin_url" | sed -E 's#^.*github\.com[:/]##; s#\.git$##')}"

# Where to push. Default: derive the wiki repo from origin.
if [ -z "${WIKI_REMOTE:-}" ]; then
  if [ -z "$origin_url" ]; then
    echo "✗ No 'origin' remote found and WIKI_REMOTE is not set." >&2
    echo "  Set WIKI_REMOTE=https://github.com/OWNER/REPO.wiki.git and re-run." >&2
    exit 1
  fi
  WIKI_REMOTE="$(printf '%s' "$origin_url" | sed -E 's#\.git$##').wiki.git"
fi

BLOB_BASE="https://github.com/${slug}/blob/${LINK_BRANCH}"

# Scratch clone; always cleaned up.
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo "→ Cloning wiki: $WIKI_REMOTE"
if ! git clone --quiet --depth 1 "$WIKI_REMOTE" "$work/wiki" 2>/dev/null; then
  echo "✗ Could not clone the wiki repo." >&2
  echo "  If this repo's wiki has never been used, create it first:" >&2
  echo "  open the repo's Wiki tab and save an initial page, then re-run." >&2
  exit 1
fi

echo "→ Syncing docs/*.md  (rewriting ../ links → $BLOB_BASE/…)"
count=0
for f in "$DOCS_PATH"/*.md; do
  [ -e "$f" ] || continue
  base=$(basename "$f")
  # Rewrite `](../something)` → `](<blob>/something)`, preserving any #anchor.
  perl -pe 'BEGIN { $b = shift } s{\]\(\.\./([^)#]+)}{]($b/$1}g' "$BLOB_BASE" "$f" \
    > "$work/wiki/$base"
  count=$((count + 1))
  echo "    • $base"
done

if [ "$count" -eq 0 ]; then
  echo "✗ No .md files found in docs/" >&2
  exit 1
fi

cd "$work/wiki"
git add -A

if git diff --cached --quiet; then
  echo "✓ Wiki already up to date — nothing to publish."
  exit 0
fi

# Commit identity: honour GIT_AUTHOR_* / existing config, fall back to a bot.
git config user.name  "${GIT_AUTHOR_NAME:-$(git config user.name  2>/dev/null || echo 'wiki-bot')}"
git config user.email "${GIT_AUTHOR_EMAIL:-$(git config user.email 2>/dev/null || echo 'wiki-bot@users.noreply.github.com')}"

sha=$(git -C "$SRC_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'local')
git commit --quiet -m "docs: sync wiki from /docs @ ${sha}"
git push --quiet origin HEAD

echo "✓ Published ${count} page(s) to the wiki."
