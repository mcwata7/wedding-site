# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
# Start full stack (Postgres + API + planner UI)
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

# Build planner UI (check for TypeScript errors)
cd frontend/internal && npm run build
```

API runs at `http://localhost:8080`. Swagger UI at `/swagger-ui.html`. Health check at `/actuator/health`.
Planner UI runs at `http://localhost:3000` (dev server or Docker).

## Environment

Copy `.env.example` to `.env` and configure:
- `POSTGRES_PASSWORD`, `JWT_SECRET` (min 32 chars), `ADMIN_EMAIL`, `ADMIN_PASSWORD`

## Architecture

**Backend:** Spring Boot 3.4.2 / Java 21 REST API with PostgreSQL. **No ORM** — uses Spring Data JDBC with hand-written SQL in `DataService.java`. Flyway manages schema migrations in `backend/src/main/resources/db/migration/`.

**Planner UI (`frontend/internal/`):** React 18 + TypeScript + Vite + TanStack Query. All server state lives in React Query; mutations invalidate related query keys. Token kept in memory via `AuthContext` (not localStorage). API calls go through `src/api/client.ts` which injects the Bearer token. Shared components are in `src/components/index.tsx`. In Docker, Nginx serves the built app and reverse-proxies `/api` to `api:8080`. For local dev, `vite.config.ts` proxies `/api` to `http://localhost:8080`.

**Package layout:** `com.wedding.service`
- `api/` — REST controllers + global error handler (`ApiErrorHandler.java`)
- `service/` — Business logic; `DataService.java` is the primary DB access wrapper
- `security/` — JWT filter chain, role-based access, `Principal` for authenticated user context
- `config/` — `AppProperties.java` binds `application.yml` wedding-specific config

## Authentication Model

Two separate auth flows, both issue JWT (HS256) Bearer tokens:
- **Planners:** `POST /api/v1/auth/planner/login` — email + bcrypt password → 8-hour token
- **Guests:** `POST /api/v1/guest/sessions` — QR token + verification answer (bcrypt hashed, case-insensitive) → 2-hour token

Route authorization in `SecurityConfig.java`:
- `/api/v1/internal/**` → ADMIN or PLANNER role only
- `/api/v1/guest/**` → GUEST role only; guests are scoped to their own party only

## Key Domain Concepts

- **Party** — invitation unit (individual/couple/household); holds the verification question/answer for guest login
- **Guest** — named attendee within a party
- **Invitation** — links party to QR token; lifecycle: `DRAFT → SENT → VIEWED → RESPONDED → CLOSED`
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

## Keeping SYSTEM_DESIGN docs current

This repo has three `SYSTEM_DESIGN.md` files:
- `SYSTEM_DESIGN.md` (root) — product-level design for the whole system (both frontends + backend).
- `backend/SYSTEM_DESIGN.md` — backend implementation design (package layout, request flow, data access, auth mechanics).
- `frontend/internal/SYSTEM_DESIGN.md` — planner UI implementation design (routing, state management, API integration).

Whenever you make a change to the app that these docs describe — a new/changed endpoint, table, page, auth flow, major dependency, architectural pattern, or functional requirement — update the relevant doc(s) as part of that same change, not as a separate follow-up. Prefer editing the existing section over appending a new one; keep the docs' existing tone (concise, code-grounded, decisions explained with rationale) rather than restating what the code already makes obvious.
