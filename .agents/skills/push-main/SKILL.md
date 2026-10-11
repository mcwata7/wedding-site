---
name: push-main
description: Commit the requested wedding-site changes, integrate the latest origin/main, run relevant checks, and push safely to main without force pushing. Use when the user invokes $push-main or requests a push to main.
---

# Push to main

Use the existing checkout and read the root `AGENTS.md`. Invoking this skill
authorizes committing and pushing the requested changes to `origin/main`,
which triggers production deployment. Complete the workflow without asking
for another confirmation. Creating or editing this skill does not invoke it.

## Review and prepare

1. Inspect `git status --short`, the staged and unstaged diffs, the current
   branch, recent history, and the origin URL. Confirm origin is the intended
   `mcwata7/wedding-site` repository. Check for an unfinished merge/rebase and
   understand it before proceeding.
2. Identify the requested changes and any local commits that would be pushed.
   Preserve unrelated edits and commits. Never use `git add .`, an automatic
   stash, `git reset --hard`, or discard user work. Stage explicit paths (or
   hunks for mixed files). If unrelated work prevents safe integration, ask
   only for the decision needed to preserve it.
3. Update relevant design documents and use
   [sync-context](../sync-context/SKILL.md) if the code map needs regeneration.
   Run `git diff --check` and `./scripts/check-context-fresh.sh`.
4. Fetch the current remote state with `git fetch origin main`. Inspect local
   commits with `git log origin/main..HEAD --oneline` and remote changes with
   `git log HEAD..origin/main --oneline`. Do not publish unrelated commits.

## Integrate and validate

1. Commit the requested changes with a concise message describing the final
   behavior, if they are not already committed. Review the staged diff before
   committing; account for pre-existing staged work without including it.
   Use the existing Git identity. If GitHub rejects the email as private, use
   the author's verified or GitHub noreply address with a command-scoped
   `-c user.email=...` override. Amend only a commit created by this workflow,
   never another author's commit or a commit already published to main.
2. If HEAD does not contain the fetched main, rebase the intended unpublished
   commits onto `origin/main`. Resolve conflicts by preserving both features;
   regenerate the code map rather than resolving generated rows by hand.
   Preserve historical migrations. If concurrent work uses the same new
   migration version, assign this task's unpublished migration the next free
   version and update references. Never rewrite an already deployed migration.
3. Run checks appropriate to all changes being published:
   - Backend: `(cd backend && ./gradlew test)`; build `bootJar` when needed.
   - Planner: `(cd frontend/internal && npm run build)`.
   - Public site: `(cd frontend/public && npm run build)`.
   - Slack app: `(cd rsvp-manager && npm test)` when affected.
   - Exercise changed UI flows in a browser when available; validate migration
     and PostgreSQL-specific behavior against a local database when affected.
   - Documentation-only changes need diff/context checks, not application
     builds. Reuse checks that already passed for unchanged code in this task.
     Re-run affected checks after conflict resolution or other material edits.
4. Fix failures and run the affected checks again. Do not push with unresolved
   conflicts or required checks failing. If a necessary check is blocked,
   explain the concrete blocker and complete independent work.
5. Review the final commit range and `git diff origin/main..HEAD --stat`.
   Run diff/context checks again after any integration changes. Ensure no
   credentials, generated build outputs, or environment-local helpers are
   included.

## Push and verify

1. Push the current HEAD explicitly to main, even when the local branch has a
   different name:

   ```bash
   git push origin HEAD:main
   ```

   Never force push or change branch protection. If rejected because main
   advanced, fetch again, inspect the new commits, integrate them, and repeat
   affected checks before retrying. An authentication error requires checking
   the existing HTTPS Git proxy before asking for credentials; never request
   secret values in chat.
2. Compare `git rev-parse HEAD` with `git ls-remote origin refs/heads/main`.
   Verify the pushed commit is the remote tip, or fetch and confirm it remains
   an ancestor if another contributor advanced main immediately afterward.
   Inspect `git status --short` and report any intentionally preserved edits.
3. Report the pushed commit with a GitHub link and summarize checks actually
   completed. Say the working tree is clean only if verified. A successful
   push triggers the deployment workflow; claim deployment success only if
   its completion was separately verified.
