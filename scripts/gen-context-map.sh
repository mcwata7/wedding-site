#!/usr/bin/env bash
# Regenerates .claude/context/MAP.md from the current code.
#
# Deterministic by construction (sorted output, no timestamps) so that
# running it twice with no code changes produces an empty git diff. This
# is what lets scripts/check-context-fresh.sh use "diff against a fresh
# run" as its staleness check.
#
# Usage: scripts/gen-context-map.sh [output-path]
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-.claude/context/MAP.md}"
mkdir -p "$(dirname "$OUT")"

BACKEND_API=backend/src/main/java/com/wedding/service/api
MIGRATIONS=backend/src/main/resources/db/migration

{
  echo "# Generated code map"
  echo
  echo "Regenerate with \`scripts/gen-context-map.sh\`. Do not hand-edit — a Stop hook"
  echo "(\`scripts/check-context-fresh.sh\`) diffs this file against a fresh run and"
  echo "flags drift. For the *why* behind these, see \`SYSTEM_DESIGN.md\` and"
  echo "\`docs/DECISIONS.md\`; this file is only the *what*, derived from code."
  echo

  echo "## Backend endpoints"
  echo
  echo "| Controller | Mapping |"
  echo "|---|---|"
  if [ -d "$BACKEND_API" ]; then
    grep -rEn '@(Get|Post|Put|Patch|Delete)Mapping|@RequestMapping' "$BACKEND_API" \
      | sed -E 's#.*/([A-Za-z0-9]+\.java):[0-9]+: *#\1 | #' \
      | sed -E 's/@(Get|Post|Put|Patch|Delete)Mapping/\1/; s/@RequestMapping/Base/' \
      | sed -E 's/^(.*)\{.*$/\1/' \
      | sed -E 's/ *$//' \
      | cut -c1-160 \
      | sort -u
  fi
  echo

  echo "## Database schema (Flyway migrations)"
  echo
  if [ -d "$MIGRATIONS" ]; then
    LATEST=$(ls "$MIGRATIONS" | sort -V | tail -1)
    echo "Latest migration: \`$LATEST\`"
    echo
    echo "| Migration | Tables touched |"
    echo "|---|---|"
    for f in $(ls "$MIGRATIONS" | sort -V); do
      tables=$(grep -Eio '(CREATE TABLE|ALTER TABLE)[[:space:]]+[a-zA-Z0-9_]+' "$MIGRATIONS/$f" \
        | awk '{print $NF}' | sort -u | paste -sd, - || true)
      echo "| $f | $tables |"
    done
  fi
  echo

  echo "## Frontend apps"
  echo
  for app in internal public; do
    dir="frontend/$app/src/pages"
    if [ -d "$dir" ]; then
      echo "### frontend/$app"
      find "$dir" -type f -name '*.tsx' | sort | sed -E "s#^#- #"
      echo
    fi
  done

  echo "## File inventory"
  echo
  echo "### Backend (\`backend/src/main/java\`)"
  find backend/src/main/java -type f -name '*.java' | sort | sed -E 's#^#- #'
  echo
  for app in internal public; do
    dir="frontend/$app/src"
    if [ -d "$dir" ]; then
      echo "### frontend/$app/src"
      find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) | sort | sed -E 's#^#- #'
      echo
    fi
  done
} > "$OUT"

echo "Wrote $OUT"
