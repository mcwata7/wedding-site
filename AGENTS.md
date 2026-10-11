# Codex project guide

This file is the repository entry point for Codex. It applies throughout the
checkout. Claude Code has its own entry point in `CLAUDE.md`; both agents use
the same design documents, decision log, and generated code map.

## Start here

1. Read `.claude/context/MAP.md` for the generated endpoint, migration, and
   source-file index. Its location is historical; Codex can use it directly.
2. Read the relevant design document: root `SYSTEM_DESIGN.md` for product
   behavior, `backend/SYSTEM_DESIGN.md` for API implementation,
   `frontend/internal/SYSTEM_DESIGN.md` for the planner UI, or
   `frontend/public/SYSTEM_DESIGN.md` for the guest site.
3. Consult `docs/DECISIONS.md` for the reasons behind existing choices.
4. Check `git status --short`, `git diff`, and recent Git history before edits.

Use the existing checkout. Codex cloud tasks already run in isolated
environments; create a Git worktree only when explicitly requested.
Preserve existing user changes and local files. Commit or push only when
requested; a push to `main` triggers production deployment.

## Development and validation

The backend requires a **Java 21 JDK** (including `javac`), not only a JRE.
Use `backend/gradlew` (Gradle 8.12.1). CI uses Node 20 for the frontends;
prefer that version when preparing a new environment. Use `npm ci` with the
checked-in lockfiles instead of changing dependency versions during setup.

Run these commands from the repository root, using subshells so the working
directory stays predictable:

```bash
# Backend tests: no PostgreSQL service required
(cd backend && ./gradlew test)
# One backend test class
(cd backend && ./gradlew test --tests 'com.wedding.service.security.JwtServiceTests')
# Build the executable backend JAR
(cd backend && ./gradlew bootJar)
# Install and build both frontends (includes TypeScript checking)
(cd frontend/internal && npm ci && npm run build)
(cd frontend/public && npm ci && npm run build)
# Optional Slack app unit tests
(cd rsvp-manager && npm ci && npm test)
```

Backend tests mix plain JUnit tests and a Spring Boot context test with inline
H2 properties. There is no checked-in `application-test.yml`. Follow nearby
tests and use PostgreSQL for checks involving real migrations or SQL behavior.
Neither frontend currently defines a separate test or lint script; its build
is the existing automated validation gate. For UI behavior, also exercise the
affected flow in a browser when browser tooling is available.

For local development, configure an ignored root `.env` using `.env.example`
without overwriting an existing file, then run `docker compose up --build`.
Required local configuration includes `POSTGRES_PASSWORD`, `JWT_SECRET`
(at least 32 characters), `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Keep values out
of source control and tool output. Standalone `bootRun` needs those settings
exported in its process; it does not automatically load the root `.env`.

Alternatively, with PostgreSQL already running:

```bash
(cd backend && ./gradlew bootRun)
(cd frontend/internal && npm run dev)
(cd frontend/public && npm run dev)
```

API port: 8080; planner: 3000; guest: 3001. Check `/actuator/health` for `UP`
and validate a representative API request, rather than relying on an open
port. Swagger is at `/swagger-ui.html`. Both Vite servers proxy `/api` to
the local API; `INTERNAL_UI_API_BASE_URL` and `PUBLIC_UI_API_BASE_URL` override
their proxy targets. `VITE_API_BASE_URL` controls the browser's API URL at
build time for the deployed frontends.

In a prepared Codex cloud environment, follow its saved startup instructions.
If `/workspace/.wedding-dev/start.py` exists, it starts the local database,
API, and frontends and checks authenticated requests through both proxies.
The onboarding JDK and Gradle cache, when present, are activated with:

```bash
export JAVA_HOME=/workspace/.tools/java21
export PATH="$JAVA_HOME/bin:$PATH"
export GRADLE_USER_HOME=/workspace/.gradle-cache
```

These helpers and paths are environment-local, not repository prerequisites.
Live processes must restart in a new cloud task. Keep TLS and artifact
verification enabled; use the environment's supported proxy and trust setup.

## Implementation conventions

- Backend: Spring Boot 3.4.2, PostgreSQL, and hand-written SQL through
  `DataService` and `JdbcTemplate`/`NamedParameterJdbcTemplate`. There is no
  ORM or repository layer. Controllers generally return maps and declare
  small request records locally.
- Reuse the generic resource allowlists for simple create/update/archive
  operations. Keep endpoints with distinct business rules explicit. Preserve
  planner-write auditing, UUID coercion, enum validation, and JSONB decoding.
- Request keys vary: typed request records generally use camelCase, while
  generic resource writes use snake_case database column names. Check the
  actual endpoint before changing a client or payload.
- Schema changes require a new numbered Flyway migration under
  `backend/src/main/resources/db/migration/`; never rewrite old migrations.
- Frontends: React 18, TypeScript, Vite, Tailwind, and TanStack Query. Keep
  API calls in `src/api/client.ts` and resource hooks in `src/api/hooks.ts`.
  Mutations invalidate the relevant server-state queries. Follow the existing
  plain controlled-form and shared-component patterns.
- Planner JWTs stay in memory; guest JWTs persist in localStorage. Guests
  authenticate by name plus their party's verification answer. Printed
  invitation tokens are no longer login credentials. Backend authorization
  enforces roles and party scope; frontend route guards are only UX.
- Preserve guest login throttling, planner overrides, wedding-wide guest RSVP semantics,
  and UTC storage with presentation in `Asia/Kathmandu`.
- Disable outbound Slack notifications for local smoke tests with
  `WEDDING_SLACK_ENABLED=false`. The separate `rsvp-manager` live app needs
  Slack credentials and is optional for the core wedding-site workflow.

## Keep context current

Codex does not execute `.claude/settings.json` Stop hooks. Before finishing
a task that changes code structure, run `./scripts/check-context-fresh.sh`.
If it reports drift, use the repository skill at
`.agents/skills/sync-context/SKILL.md` (invoke as `$sync-context` when available)
or run `./scripts/gen-context-map.sh` and review the generated diff manually.
Use one shared map; do not create a second Codex copy or edit generated rows.

Update the relevant design document alongside changes to endpoints, schema,
pages, authentication, dependencies, or product behavior. Record non-obvious
choices in `docs/DECISIONS.md`, adding new entries at the top and preserving
past entries. Review the full change because the map cannot detect behavioral
drift. Report checks actually run and any unresolved failures.

## Deployment

Use `$push-main` (the repository skill at
`.agents/skills/push-main/SKILL.md`) when asked to commit and push changes to
`main`. It covers review, integration with remote changes, relevant checks,
and verification of the pushed commit.

Production runs the API, PostgreSQL, and Caddy on a GCP Compute Engine VM;
both frontends use Firebase Hosting. `.github/workflows/deploy.yml` is the
normal deployment path. Root Makefile deploy targets are a manual fallback.
Build backend images in CI rather than on the small production VM.

Keep one-time provisioning or credential-rotation procedures in reviewable,
idempotent scripts under `scripts/`. Follow the user's authorization for
deployment or infrastructure changes; local development setup does not
authorize changing the production environment.
