#!/usr/bin/env bash
# Stop-hook check: has code structure (endpoints/schema/routes/files) drifted
# from the committed .claude/context/MAP.md?
#
# Regenerates the map to a scratch file and diffs it against the committed
# one. Exits non-zero (with the diff) if they differ, so a Claude Code
# session sees it before ending its turn and can run the generator +
# consider whether SYSTEM_DESIGN.md / docs/DECISIONS.md need a matching
# update. Exits 0 silently when nothing structural changed, so ordinary
# bugfixes never get nagged.
set -euo pipefail
cd "$(dirname "$0")/.."

CURRENT=.claude/context/MAP.md
SCRATCH=$(mktemp)
trap 'rm -f "$SCRATCH"' EXIT

./scripts/gen-context-map.sh "$SCRATCH" >/dev/null

if [ ! -f "$CURRENT" ]; then
  echo "MAP.md missing. Run: scripts/gen-context-map.sh" >&2
  exit 1
fi

if ! diff -q "$CURRENT" "$SCRATCH" >/dev/null; then
  echo "Context map is stale (endpoints/schema/routes/files changed since last regen)." >&2
  echo >&2
  diff "$CURRENT" "$SCRATCH" >&2 || true
  echo >&2
  echo "Run: scripts/gen-context-map.sh, then check whether SYSTEM_DESIGN.md or" >&2
  echo "docs/DECISIONS.md need a matching update, then commit both together." >&2
  exit 1
fi

exit 0
