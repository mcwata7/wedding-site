---
name: sync-context
description: Regenerate the project's code map and check whether SYSTEM_DESIGN.md or docs/DECISIONS.md need updating after a change. Run this when the Stop hook flags context drift, or manually after a change that adds/removes an endpoint, table, page, or major dependency.
---

# Sync context

This project keeps a layered knowledge base so sessions don't have to
re-scan the repo (see `CLAUDE.md` "Start here"). This skill is the manual
escape hatch for keeping it fresh — the same thing the `Stop` hook checks
automatically.

## Steps

1. Regenerate the generated code map:
   ```bash
   ./scripts/gen-context-map.sh
   ```
2. Check what changed:
   ```bash
   git diff .claude/context/MAP.md
   ```
3. For each change in that diff, decide if it needs a matching prose update:
   - **New/changed/removed endpoint** → update the relevant `SYSTEM_DESIGN.md`
     (root for product-level behavior, `backend/SYSTEM_DESIGN.md` for
     request-flow/auth detail).
   - **New/changed table (Flyway migration)** → update `backend/SYSTEM_DESIGN.md`
     data model section.
   - **New frontend page/route** → update `frontend/internal/SYSTEM_DESIGN.md`
     or the root doc, whichever owns that area.
   - **A non-obvious choice was made** (rejected an alternative, worked around
     a constraint) → append an entry to `docs/DECISIONS.md` (newest at top,
     never edit past entries — see its header for the format).
4. Review the full session diff for anything the map's grep-based extraction
   doesn't catch (e.g. auth logic changes, new domain concepts):
   ```bash
   git diff
   ```
5. Commit the code change, the regenerated `.claude/context/MAP.md`, and any
   doc updates together — not as a separate follow-up commit.

If nothing in the diff is structurally significant (e.g. only a docstring or
one-line bugfix triggered file-inventory churn), just commit the regenerated
map with no doc changes.
