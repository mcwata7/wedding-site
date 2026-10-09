---
name: sync-context
description: Refresh the shared generated code map and update project design documentation after changes to endpoints, schema, frontend pages, authentication, dependencies, or architecture.
---

# Sync project context

Use this skill after structural or architectural changes, or when
`scripts/check-context-fresh.sh` reports drift. Read the root `AGENTS.md`
for the project conventions. Run commands from the repository root.

The shared generated map remains at `.claude/context/MAP.md`. Claude and
Codex use the same map and design documents; do not maintain a separate copy.
Codex runs the freshness check explicitly rather than relying on Claude's
Stop hook.

1. Inspect the current working changes so existing user edits are preserved:

   ```bash
   git status --short
   git diff
   ```

2. Regenerate the map and review its changes:

   ```bash
   ./scripts/gen-context-map.sh
   git diff -- .claude/context/MAP.md
   ```

3. Update prose only where the change requires it:
   - Endpoint or API behavior: root `SYSTEM_DESIGN.md` for product behavior
     and `backend/SYSTEM_DESIGN.md` for implementation or authorization.
   - New schema migration: `backend/SYSTEM_DESIGN.md` data-model discussion.
   - Frontend page, route, or presentation: the relevant
     `frontend/internal/SYSTEM_DESIGN.md` or `frontend/public/SYSTEM_DESIGN.md`.
   - Non-obvious choice or rejected alternative: a new entry at the top of
     `docs/DECISIONS.md`, following its format and preserving old entries.

4. Review the full task diff for behavior the map's extraction cannot detect
   (authentication, validation, state transitions, dependencies, etc.). A
   change only to ordering or file inventory may need no prose update. Never
   edit generated map rows by hand.

5. Run `./scripts/check-context-fresh.sh` and the checks relevant to the code
   change. Report what passed and any remaining failures. Keep code, map, and
   necessary documentation changes together for review. Commit only if the
   user requested it, and never push merely to synchronize documentation.
