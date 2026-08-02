#!/bin/sh
#
# Conventional Commits validator — the single source of truth for commit-message
# rules, shared by the local `commit-msg` hook and the CI "Commit messages" job
# so the two can never drift (a --no-verify bypass is still caught by CI).
#
# Usage: lint-commit-msg.sh "<subject line>"
#   exit 0 → valid, exit 1 → invalid (prints guidance to stderr).
#
# `release` is included on top of the standard types because this repo tags
# releases with `release:` subjects. Merge/Revert/fixup!/squash!/amend! subjects
# (produced by git itself during merges and autosquash rebases) are allowed as-is.

subject=$1

types='feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|release'
# type(optional-scope)!: description   OR   a git-generated subject
pattern="^((${types})(\([a-z0-9._/-]+\))?!?: .+|Merge |Revert |fixup!|squash!|amend!)"

if printf '%s' "$subject" | grep -qE "$pattern"; then
  exit 0
fi

echo "✗ Invalid commit message:" >&2
echo "    ${subject}" >&2
echo "" >&2
echo "  Use Conventional Commits — <type>(<optional scope>): <description>" >&2
echo "  Allowed types: ${types}" >&2
echo "  Examples: 'feat(backend): add booking overlap check'  'fix: correct TZ'  'release: v1.2.0'" >&2
exit 1
