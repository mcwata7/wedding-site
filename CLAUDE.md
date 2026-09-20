# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here (cold session)

Don't scan the tree from scratch. In order:

1. `.claude/context/MAP.md` — generated endpoint/schema/route/file index (see "Generated code map" below).
2. This file, then the relevant `SYSTEM_DESIGN.md` (see "Keeping docs current" below).
3. `docs/DECISIONS.md` — the *why* behind non-obvious choices.
4. `git log --oneline -20` — what other sessions did recently.

## Concurrent sessions

Multiple Claude Code sessions may edit this repo at once. Git history is the
shared record between them:
- Commit your own work reasonably often, especially before a long pause.
- Run `git log`/`git diff` to see what another session changed before you
  start editing a file you haven't touched yet this session.
- If `.claude/context/MAP.md` looks out of date, run
  `./scripts/gen-context-map.sh` (a `Stop` hook already checks this
  automatically at the end of each turn — see `/sync-context`).

## Deployment

Production deploys go through `.github/workflows/deploy.yml` (push to
`main`, or `gh workflow run deploy.yml`) — that is the deploy path, not a
one-off script run from a laptop. The Makefile's `make deploy*` targets
are a manual fallback only, for when CI itself is unavailable.

Any one-time or manual step that has to run directly from a human's
machine (provisioning cloud resources, rotating a credential, fixing VM
state, etc.) belongs in a checked-in shell script under `scripts/`, not
a command run ad hoc and discarded — e.g. `scripts/setup-deploy-auth.sh`.
Write it idempotent (safe to re-run) and let the person review it before
running, the same way that script was introduced.

## Build & Run

```bash
# Start full stack (Postgres + API + planner UI + guest UI)
docker compose up --build

# Backend only (requires Postgres running)
cd backend && ./gradlew bootRun

# Run tests (uses H2 in-memory, no Postgres needed)
cd backend && ./gradlew test

# Run a single test class
cd backend && ./gradlew test --tests "com.wedding.service.SomeTest"

# Build production JAR
cd backend && ./gradlew bootJar

# Planner UI dev server (proxies /api to http://localhost:8080)
cd frontend/internal && npm install && npm run dev

# Guest UI dev server (proxies /api to http://localhost:8080)
cd frontend/public && npm install && npm run dev

# Build a UI (check for TypeScript errors)
cd frontend/internal && npm run build   # or frontend/public
```

API runs at `http://localhost:8080`. Swagger UI at `/swagger-ui.html`. Health check at `/actuator/health`. When run via `docker compose`, the `api` container also exposes a JVM remote-debug (JDWP) port at `localhost:5005` — point an IDE's remote-debug config at it.
Planner UI runs at `http://localhost:3000` (dev server or Docker). Guest UI runs at `http://localhost:3001`.

## Environment

Copy `.env.example` to `.env` and configure:
- `POSTGRES_PASSWORD`, `JWT_SECRET` (min 32 chars), `ADMIN_EMAIL`, `ADMIN_PASSWORD`

## Architecture

**Backend:** Spring Boot 3.4.2 / Java 21 REST API with PostgreSQL. **No ORM** — uses Spring Data JDBC with hand-written SQL in `DataService.java`. Flyway manages schema migrations in `backend/src/main/resources/db/migration/`.

**Planner UI (`frontend/internal/`):** React 18 + TypeScript + Vite + TanStack Query. All server state lives in React Query; mutations invalidate related query keys. Token kept in memory via `AuthContext` (not localStorage). API calls go through `src/api/client.ts` which injects the Bearer token. Shared components are in `src/components/index.tsx`. In Docker, Nginx serves the built app and reverse-proxies `/api` to `api:8080`. For local dev, `vite.config.ts` proxies `/api` to `http://localhost:8080`.

**Guest UI (`frontend/public/`):** Same stack (React 18 + TypeScript + Vite), guest-facing wedding site (Home, Travel, Schedule, Things to Do). Auth via `GuestAuthContext` (QR-token + verification-answer session, not planner login). Mirrors the planner UI's structure (`src/api/`, `src/components/index.tsx`, `src/pages/`). See root `SYSTEM_DESIGN.md` for the guest-facing product spec.

**Package layout:** `com.wedding.service`
- `api/` — REST controllers + global error handler (`ApiErrorHandler.java`)
- `service/` — Business logic; `DataService.java` is the primary DB access wrapper
- `security/` — JWT filter chain, role-based access, `Principal` for authenticated user context
- `config/` — `AppProperties.java` binds `application.yml` wedding-specific config

## Authentication Model

Two separate auth flows, both issue JWT (HS256) Bearer tokens:
- **Planners:** `POST /api/v1/auth/planner/login` — email + bcrypt password → 8-hour token
- **Guests:** `POST /api/v1/guest/sessions` — guest name (resolved to their party) + verification answer (bcrypt hashed, case-insensitive) → 30-day token, persisted in the guest UI's `localStorage`. Attempts are throttled per party by `GuestLoginThrottle` (5/minute, 5-minute lock at 10 consecutive failures, permanent lock at 30)

Route authorization in `SecurityConfig.java`:
- `/api/v1/internal/**` → ADMIN or PLANNER role only
- `/api/v1/guest/**` → GUEST role only; guests are scoped to their own party only
- `POST /api/v1/internal/parties/*/unlock` → ADMIN only (clears a permanent guest-login lock)

## Key Domain Concepts

- **Party** — invitation unit (individual/couple/household); holds the verification question/answer for guest login
- **Guest** — named attendee within a party
- **Invitation** — links party to an invitation token (printed on cards; no longer an auth credential); lifecycle: `DRAFT → SENT → VIEWED → RESPONDED → CLOSED`
- **Event** — wedding activity (mehndi, sangeet, ceremony, reception); stored UTC, presented in `Asia/Kathmandu`
- **RSVP** — per-guest per-event; auto-waitlisted when event capacity reached (guests cannot self-waitlist)
- **audit_record** — every planner write operation is logged with before/after JSON snapshots

## Data Access Patterns

`DataService.java` provides typed wrappers over `NamedParameterJdbcTemplate`:
- `one(sql, params, rowMapper)` — expects exactly one result
- `many(sql, params, rowMapper)` — returns list
- UUID generation and token hashing (SHA-256 + Base64) are centralized here

SQL queries live in the service/controller methods directly (no repository interfaces). When adding a new endpoint, follow the existing pattern: controller validates/extracts from request → calls service or DataService directly → returns response DTO.

## Testing

Tests use H2 with `application-test.yml` overrides. Spring Security Test is included for mocking authenticated principals. No Mockito or separate mocking framework — prefer `@SpringBootTest` integration tests against H2.

## Adding Database Changes

Add a new Flyway migration file: `backend/src/main/resources/db/migration/V{N}__description.sql`. Flyway runs automatically on startup; never edit existing migration files.

## Generated code map

`.claude/context/MAP.md` is a generated (not hand-edited) index of backend
endpoints, Flyway schema, and frontend pages/files, produced by
`scripts/gen-context-map.sh`. A `Stop` hook (`scripts/check-context-fresh.sh`,
wired in `.claude/settings.json`) regenerates it at the end of each turn and
flags drift on stderr if endpoints/schema/routes/files changed since it was
last committed. When flagged, run `/sync-context` (or just
`./scripts/gen-context-map.sh` and commit the result).

## Keeping docs current

This repo has four `SYSTEM_DESIGN.md` files:
- `SYSTEM_DESIGN.md` (root) — product-level design for the whole system (both frontends + backend).
- `backend/SYSTEM_DESIGN.md` — backend implementation design (package layout, request flow, data access, auth mechanics).
- `frontend/internal/SYSTEM_DESIGN.md` — planner UI implementation design (routing, state management, API integration).
- `frontend/public/SYSTEM_DESIGN.md` — guest UI implementation design.

Plus `docs/DECISIONS.md` — an append-only log of non-obvious choices and
rejected alternatives (the *why* the other docs don't capture).

Whenever you make a change to the app that these docs describe — a new/changed endpoint, table, page, auth flow, major dependency, architectural pattern, or functional requirement — update the relevant doc(s) as part of that same change, not as a separate follow-up. Prefer editing the existing section over appending a new one; keep the docs' existing tone (concise, code-grounded, decisions explained with rationale) rather than restating what the code already makes obvious. Use `/sync-context` to check what needs updating after a change (this is also what the `Stop` hook prompts you to run).
