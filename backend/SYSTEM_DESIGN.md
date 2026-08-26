# Wedding Planning Backend — Implementation Design

## 1. Overview

This document describes how `backend/` is actually built: package layout, request handling, data access, and security mechanics. For the product-level requirements this service satisfies (domain concepts, functional requirements, API contract, policies), see the root [`SYSTEM_DESIGN.md`](../SYSTEM_DESIGN.md) — this doc is its implementation companion, scoped to "how," not "what/why."

The service is a single Spring Boot 3.4 / Java 21 module (`com.wedding.service`) backed by PostgreSQL, with **no ORM**: every query is hand-written SQL executed through a thin `DataService` wrapper over Spring's `JdbcTemplate`/`NamedParameterJdbcTemplate`. This is a deliberate choice for a small, short-lived domain model — see §12.

## 2. Goals

- Keep the whole backend legible in one sitting: as of this writing it is ~11 small controller/service classes plus three migrations, with no framework-generated boilerplate (no repository interfaces, no entity classes, no mapper layer).
- Make every planner write traceable: any INSERT/UPDATE reachable from `/api/v1/internal/**` records a before/after audit row.
- Fail loudly and uniformly: every error path — business rule violation, bean-validation failure, or unexpected exception — returns the same JSON error shape with a request ID a planner can hand back for debugging.

## 3. Scope

In scope: HTTP API, authentication/authorization, SQL persistence and migrations, CSV import/export, scheduled FX-rate capture, audit logging, local image storage for the public site. Out of scope (owned elsewhere or not yet built): the planner UI (`frontend/internal/`, see its own `SYSTEM_DESIGN.md`), the guest UI (`frontend/public/`, see its own `SYSTEM_DESIGN.md`), and any notification/delivery integration (root design §5.6 — delivery is planner-recorded, not sent by this service).

## 4. Package Layout

```text
com.wedding.service
├── api/       REST controllers, ApiException, ApiErrorHandler, RequestIdFilter
├── service/   DataService (DB access), BootstrapService, FxRateService, MediaService,
│              InvitationCardRenderer (PDF/QR rendering), MediaSeedService
├── security/  SecurityConfig, JwtFilter, JwtService, Principal
└── config/    AppProperties (typed config binding), WebConfig
```

There is no `repository`, `model`/`entity`, or `dto` package: controllers query through `DataService` directly and return `Map<String,Object>` (or `List<Map<String,Object>>`) rows straight from SQL, serialized by Jackson. Request bodies use small local `record`s declared inside the controller that needs them (e.g. `AuthController.Login`, `InternalController.PartyInput`) rather than shared DTO classes.

## 5. Request Flow and Controllers

Every request passes through, in order: `RequestIdFilter` (`@Order(1)`, stamps a UUID onto the request and an `X-Request-Id` response header) → Spring Security's filter chain, including `JwtFilter` → the matched `@RestController` method → `ApiErrorHandler` if anything throws.

| Controller | Base path | Responsibility |
| --- | --- | --- |
| `AuthController` | `/api/v1/auth`, `/api/v1/guest/sessions` | Planner login (email/password); guest session (QR token + verification answer) |
| `GuestController` | `/api/v1/guest/**` | Self-service: view party/guests, update editable guest fields, view eligible events, RSVP, view accommodation, file a change request |
| `InternalController` | `/api/v1/internal/**` | Planner writes: create party/guest, issue QR invitation, record delivery, create event/venue/accommodation/budget/things-to-do-item records, manual RSVP override |
| `InternalDataController` | `/api/v1/internal/**` | Planner reads (dashboard, list/detail endpoints) plus **generic** update/archive for simple lookup-style resources, plus site-settings read/update |
| `GuestImportController` | `/api/v1/internal/guests` | CSV bulk guest import + downloadable import template |
| `ReportController` | `/api/v1/internal/reports` | CSV exports (attendance, dietary, rooming, budget) |
| `SiteController` | `/api/v1/guest/site` | Guest-facing public-site reads: config (settings + visible pages), schedule, things-to-do items — kept separate from `GuestController` so its `public_visible` filter never touches RSVP eligibility |
| `MediaController` | `/api/v1/internal/media`, `/api/v1/media/{id}` | Image upload/list (planner-only) and unauthenticated image read (an `<img src>` can't send a Bearer header) |
| `InvitationCardController` | `/api/v1/internal/parties/{id}/invitation-card.pdf`, `/api/v1/internal/invitation-cards.pdf`, `/api/v1/internal/invitation-cards/issue-missing` | Renders printable A6 QR invitation cards. Kept separate from `InternalController` (which mints the underlying tokens) since PDF generation is a distinct concern with its own failure modes. The two `GET` PDF endpoints never mutate: if any non-archived party lacks a printable token they fail with `409 MISSING_INVITATION(S)` rather than silently minting one — the planner calls `issue-missing` explicitly first, which mints tokens only for parties that don't have one yet. |

Two implementation patterns are worth calling out because they're not obvious from a single controller in isolation:

- **Generic create.** `InternalController.createSimple(actor, table, input, allowedFields)` backs the venue/property/room/budget-category/contributor/line-item POST endpoints: it filters the request map to an explicit allowed-fields list, inserts, and audits — one method instead of six near-identical ones.
- **Generic update/archive.** `InternalDataController` holds `TABLES` (route resource name → SQL table) and `COLUMNS` (route resource name → editable-column allowlist) maps. `PATCH /internal/resources/{resource}/{id}` and `POST /internal/resources/{resource}/{id}/archive` dispatch through these maps for every simple resource (parties, guests, venues, events, properties, rooms, budget categories/contributors/line-items). Guests are the one exception baked into `archive()`: archiving a guest sets `active=false`, not `archived=true`, matching the `guest` table's own soft-delete column. Adding a new simple lookup resource means adding one `TABLES`/`COLUMNS` entry, not a new controller method — extend this pattern rather than writing a bespoke PATCH/archive pair.

Endpoints with real business logic (RSVP status transitions, accommodation capacity, CSV import validation) are written out individually rather than genericized, since their rules differ per-endpoint.

**Request-body key convention is not uniform — this has caused real bugs.** Endpoints backed by a typed `record` + `@Valid @RequestBody` (`PartyInput`, `GuestInput` in `InternalController`, and the event-create endpoint's `Map` access via `in.get("venueId")`/`in.get("startsAt")`) bind/read **camelCase** keys, because that's the Java field name Jackson matches against. Endpoints backed by `createSimple` or the generic `PATCH /internal/resources/{resource}/{id}` take a raw `Map<String,Object>` filtered against a `Set<String>` of **snake_case** SQL column names, because those keys are used as literal column/parameter names. Every read endpoint returns raw SQL rows, so responses are snake_case throughout — only *some* writes are camelCase. A client that generalizes "the API is snake_case" from the read endpoints will silently 400 (validation failure on a record) or 500 (missing named SQL parameter) on `POST /internal/parties`, `POST /internal/parties/{id}/guests`, and `POST /internal/events`. When adding a new record-backed endpoint, either accept this split and document it at the call site, or bind camelCase-in/snake_case-out consistently — don't add a third convention.

## 6. Data Access

`DataService` (`service/DataService.java`) is intentionally ~20 lines:

- `one(sql, params)` — runs a named-parameter query, throws `ApiException(404, "NOT_FOUND")` if it returns no rows, otherwise returns the first row as a `Map<String,Object>`.
- `many(sql, params)` — same, returns the full row list.
- `audit(actor, action, entityType, entityId, before, after)` — serializes `before`/`after` to JSON (via the shared Jackson `ObjectMapper`) and inserts into `audit_record`. Called after essentially every planner-initiated write.
- `uuid()` / `id(value)` — UUID generation and parsing helpers used instead of relying on the driver's UUID handling everywhere.
- `hashToken(value)` — SHA-256 + Base64, used as `invitation.token_hash`, the unique column looked up on every guest login and lookup call. `invitation.token` (added in `V4`) additionally retains the raw value — see §12's design-decision entry for why, and never `SELECT * FROM invitation` or add `"invitation"` to `InternalDataController.TABLES`, both of which would leak that column into a response or an audit before/after snapshot.
- `passwords` — a shared `BCryptPasswordEncoder`, used for planner passwords and for party verification answers (case-insensitive: answers are lowercased/trimmed before hashing and before comparison).

Controllers build `NamedParameterJdbcTemplate`/`MapSqlParameterSource` calls directly; there is no query-builder or criteria API. Nullable/optional filters are expressed as `(:param IS NULL OR column = :param)` (see `ReportController.attendance`) rather than conditionally constructing SQL strings, except where the WHERE clause itself needs to change shape (e.g. `InternalDataController.rsvps` appends a clause only when `eventId` is present).

Schema changes go through Flyway migrations in `src/main/resources/db/migration/` (`V1__initial_schema.sql`, `V2__planner_ui_lifecycle.sql`, `V3__public_site.sql`, `V4__invitation_cards.sql`, `V5__things_to_do.sql`); per project convention, past migrations are never edited — see root `CLAUDE.md`. `V1` establishes the full domain schema in one file (parties, guests, invitations, events, venues, RSVPs, accommodations, budget, FX snapshots, audit); `V2` is a small additive migration (archived flags on lookup entities, a partial unique index on active guest email); `V3` adds the public-site tables (`media_asset`, `site_settings` — a singleton row enforced by a `CHECK` constraint on a `UNIQUE` boolean column, `site_page`, `travel_item`) and an `event.public_visible` flag independent of RSVP eligibility; `V4` adds `invitation.token` (the raw, recoverable QR token) and four `site_settings` columns for the invitation card's artwork and text (`invitation_image_id`, `invitation_headline`, `invitation_body`, `invitation_footer`); `V5` drops `travel_item` (the Travel tab is now a single free-text body on `site_settings`) and replaces it with `thing_to_do_item` (category, title, description, optional image) plus a `things_to_do_heading`/`things_to_do_body` pair on `site_settings`, and flips the previously-hidden `things-to-do` `site_page` row visible.

## 7. Error Handling

`ApiException` is a typed `RuntimeException` carrying an HTTP status and a machine-readable `code` (e.g. `NOT_FOUND`, `INVALID_CREDENTIALS`, `ROOM_CAPACITY`, `RSVP_CLOSED`) — controllers throw it directly for business-rule violations rather than returning error DTOs. `ApiErrorHandler` (`@RestControllerAdvice`) maps three cases to a consistent JSON body (`code`, `message`, `requestId`, plus `errors` for validation failures):

1. `ApiException` → its own status/code.
2. `MethodArgumentNotValidException` (bean-validation failures on `@Valid @RequestBody`) → `400 VALIDATION_ERROR` with a per-field error list.
3. Anything else → `500 INTERNAL_ERROR`, logged server-side with the full stack trace (never leaked to the client), correlated via the `requestId` set by `RequestIdFilter`.

## 8. Authentication and Security

- **Token format.** JWTs are hand-rolled in `JwtService` (HMAC-SHA256, base64url header/claims/signature, no external JWT library) rather than using a library like `jjwt`. Claims are `sub` (subject UUID), `role`, `partyId` (guest tokens only), and `exp`. Signature verification uses `MessageDigest.isEqual` for constant-time comparison. This keeps the dependency footprint minimal for a two-flow, single-secret auth model — reach for a real JWT library first if claims, algorithms, or key rotation ever need to grow beyond this.
- **Two issuance paths**, both in `AuthController`, both ultimately calling `JwtService.create(...)`:
  - Planner login: email/bcrypt-password against `planner_user`, issues an 8-hour (`wedding.security.planner-session-minutes`) token with `role` = `ADMIN`/`PLANNER`.
  - Guest session: QR token (looked up by SHA-256 hash) + bcrypt-verified answer against the party's `verification_answer_hash`, issues a 2-hour (`guest-session-minutes`) token with `role=GUEST` and `partyId` set. A first-time guest login also flips the invitation from `DRAFT` to `VIEWED`.
- **`JwtFilter`** runs before Spring's `UsernamePasswordAuthenticationFilter`, reads `Authorization: Bearer <token>`, and — if it parses — sets a `Principal` (record: `id`, `role`, `partyId`) as the authenticated principal with a single `ROLE_<role>` authority. An invalid/expired token is *silently* left unauthenticated (caught `IllegalArgumentException`) rather than rejected at the filter; authorization then denies the request downstream based on `SecurityConfig`'s matchers.
- **`SecurityConfig`** is stateless (no HTTP sessions, CSRF disabled since there's no cookie-based auth), sets a `default-src 'self'` CSP header, and authorizes by path prefix: `/api/v1/internal/**` → `ADMIN`/`PLANNER`, `/api/v1/guest/**` → `GUEST`, everything else denied except the explicit public list (health check, Swagger UI, `/api/v1/auth/**`, `/api/v1/guest/sessions`, `/api/v1/guest/invitations/lookup`, `/api/v1/media/**`). The last two exist because `anyRequest().denyAll()` blocks anything not explicitly listed: the invitation lookup has to run *before* a guest session exists (it shows the verification question), and image reads have to work from a plain `<img src>`, which can't carry a bearer token. Both matchers must be listed ahead of the `/api/v1/guest/**` → `GUEST` rule to take effect; `/api/v1/media/**` sits outside that prefix entirely so it never collides with it.
- Party-level isolation for guests is enforced in SQL, not in the security layer: every `GuestController` query filters by `p.partyId()` from the parsed token, so a valid guest token can only ever reach rows belonging to its own party.
- `BootstrapService` (an `ApplicationRunner`, gated by `wedding.bootstrap-enabled`, default on) seeds exactly one `ADMIN` planner user from `wedding.bootstrap-admin.*` config if `planner_user` is empty — this is how the first login exists in a fresh environment.
- Both `InvitationCardController` PDF endpoints sit under `/api/v1/internal/**`, so they inherit the existing `ADMIN`/`PLANNER` matcher with no `SecurityConfig` change. They are deliberately **not** given the `/api/v1/media/**`-style public exemption: a bulk card PDF contains every printable party's factor-one credential, so making it fetchable by URL alone would be the worst regression available in this codebase.

## 9. Scheduled Work

`FxRateService` runs daily at 02:15 server time (`@Scheduled(cron = "0 15 2 * * *")`), gated by `wedding.fx.enabled`, and pulls latest rates for the configured base currency from the Frankfurter API (`api.frankfurter.dev`, a free/no-key exchange-rate service) into `fx_rate_snapshot`, one row per (base, quote, date, source), via `ON CONFLICT DO NOTHING` so re-runs on the same day are idempotent. A failed fetch is logged and swallowed — the job retains whatever the last successful snapshot was rather than failing the app or leaving partial data, per root design §9's currency-conversion decision.

`MediaSeedService` is a second `ApplicationRunner`, gated by the same `wedding.bootstrap-enabled` flag as `BootstrapService` (matters because `WeddingServiceApplicationTests` sets that flag `false` against a schema-less H2, and this runner queries `media_asset`/`site_settings`, which don't exist there). On boot it seeds the bundled default invitation-card artwork (`resources/seed/invitation-card-default.jpg`) into `media_asset` and the local media directory under a fixed UUID, then points `site_settings.invitation_image_id` at it — but only while that column is still `NULL`, so a planner's own artwork choice is never overwritten on restart.

## 10. Non-Functional Notes

- Response shape is uniform `Map<String,Object>`/`List<Map<String,Object>>` JSON, not versioned DTOs — acceptable at this scale (root design §9: ~200 guests, ~5 planners, correctness/simplicity over throughput) but means a column rename in SQL is a wire-format change; grep controllers for the column name before renaming one.
- Every planner-writable table that matters for reporting/accountability is archived (soft-deleted), never hard-deleted, so history and audit rows stay valid.
- `application.yml` binds every tunable through `AppProperties` (`wedding.security.*`, `wedding.bootstrap-admin.*`, `wedding.fx.*`, `wedding.media.*`) with environment-variable overrides and local-dev defaults — there is no scattered `@Value` usage.

## 11. Technology and Build

- **Framework:** Spring Boot 3.4.2, Java 21 (Gradle toolchain-pinned).
- **Dependencies:** `spring-boot-starter-web`, `-security`, `-jdbc`, `-validation`, `-actuator`; `flyway-core` + `flyway-database-postgresql`; `springdoc-openapi-starter-webmvc-ui` (Swagger UI at `/swagger-ui.html`); `postgresql` driver at runtime. No ORM (`spring-boot-starter-data-jpa` is intentionally absent). `com.google.zxing:core` + `org.apache.pdfbox:pdfbox` render invitation cards: ZXing's `Encoder` produces a `ByteMatrix` that's drawn straight into the PDF as vector rectangles rather than rasterized through `zxing:javase`, so the QR stays crisp at any print resolution and the extra artwork-rendering dependency isn't needed.
- **Testing:** `spring-boot-starter-test` + `spring-security-test`, with `h2` as an in-memory test-only database (`postgresql` also available at test runtime for dialect compatibility). No Mockito — tests are `@SpringBootTest` integration tests against H2 per `application-test.yml`, run with `./gradlew test`.
- **Build/deploy:** multi-stage `Dockerfile` — `gradle:8.12-jdk21` builds a boot JAR (`gradle bootJar`), then `eclipse-temurin:21-jre` runs it. In the compose stack this is the `api` service; Postgres and the Nginx-served planner UI are the other two.

## 12. Design Decisions

- **No ORM, no repository layer.** With ~15 tables, hand-mapped `Map<String,Object>` rows, and short-lived project scope, an ORM's mapping/lazy-loading machinery is overhead this codebase doesn't need. If the schema or query complexity grows substantially past its current size, revisit this — it is a fit-for-scale choice, not a permanent constraint.
- **Hand-rolled JWT over a library.** Two flows, one signing secret, four claims — a full JWT library's algorithm negotiation and key-rotation support isn't exercised here. `JwtService` should stay this simple; if requirements grow (multiple keys, asymmetric signing, refresh tokens), switch to a real library rather than extending the hand-rolled implementation.
- **Generic resource endpoints over one-per-entity CRUD.** §5's `createSimple`/`TABLES`+`COLUMNS` pattern trades some type safety (editable fields are an allowlist `Set<String>`, checked at runtime, not the compiler) for not having a dozen near-identical controller methods. New *simple* lookup resources should extend the existing maps; entities with real business rules (RSVP, accommodation assignment) should keep their own explicit endpoint.
- **RSVP capacity enforcement differs by actor.** A guest RSVPing themselves to `ATTENDING` on a full event is silently redirected to `WAITLISTED` (`GuestController.rsvp`) — guests cannot choose to overbook. A planner's manual RSVP override (`InternalController.manualRsvp`) does not re-check capacity at all, since planners are trusted to manage waitlist promotion deliberately (root design §5.3).
- **Accommodation capacity is checked, and overridable, at write time.** `InternalController.assignment` sums already-booked occupants for the room across the requested date range and rejects the insert with `409 ROOM_CAPACITY` unless `override_capacity` is set, in which case the audit action itself changes to `OVERRIDE_CAPACITY` instead of `CREATE` — the override is visible in the audit trail without a separate flag to check.
- **CSV import validates before writing anything.** `GuestImportController` parses the whole file, collects every row-level error (missing required column, missing required field, duplicate active email) up front, and throws a single `400 IMPORT_INVALID` with all errors joined if any exist — it never partially imports a batch.
- **Media storage is local disk, not object storage.** `MediaService` writes uploaded images to a configured directory (`wedding.media.dir`, a Docker volume in compose) keyed by the `media_asset` UUID, and `MediaController` streams them back by ID. This matches the rest of the stack's "small, self-contained deployment" posture — an S3-compatible store is the natural upgrade if the app ever needs multi-instance/horizontal scaling, since local disk doesn't survive a container being replaced without the volume.
- **`event.public_visible` is independent of `event_eligibility`.** Eligibility controls who can RSVP; `public_visible` controls whether an eligible event shows on the public Schedule tab. Keeping them as separate columns (rather than inferring visibility from eligibility) lets a planner stage an event's RSVP collection before announcing it publicly, without special-casing the RSVP guest API.
- **Invitation tokens are stored recoverable (`invitation.token`), not only hashed.** Printed cards need to be reprintable and the bulk PDF needs to be idempotent, which requires the server to reproduce a party's exact token on demand. Four options were considered: (a) store the raw token in a new column; (b) derive it deterministically via `HMAC(secret, invitationId:version)`, keeping nothing at rest; (c) encrypt it at rest with a dedicated key; (d) never store it, re-issuing on every PDF generation. (a) was chosen. The deciding factor is the threat model, not the token's format: the token is only the first of two access factors (the party's bcrypt-hashed verification answer is the second), and it is printed in plaintext on a card that travels through the postal system — hashing it at rest defended against a database-compromise adversary who, by construction, would already be able to read everything the token protects. (b) and (c) trade that non-benefit for a real one: a lost or rotated key silently bricks every card already mailed, months later, with no test able to catch it in advance. (d) actively breaks the product — reprinting a damaged card, or downloading the bulk PDF twice, would rotate tokens under cards already in the post and reset their `status` back to `DRAFT`. **Invariant to preserve:** never `SELECT * FROM invitation`, and never add `"invitation"` to `InternalDataController.TABLES` — both would leak the raw token into an API response or an audit before/after snapshot. `InvitationCardController`'s `GET` endpoints also never mutate: a party missing a printable token fails the request with `409 MISSING_INVITATION(S)` instead of silently minting one, so a retry, prefetch, or double-click can never rotate a token that's already on a mailed card — issuing one requires the separate, explicit `POST .../issue-missing`.
- **Standard-14 PDF fonts are WinAnsi-encoded.** `InvitationCardRenderer` uses Helvetica/Courier for layout simplicity, but WinAnsi covers Latin-1 plus a handful of extras — no Devanagari, no CJK. Rather than fail mid-render on the 200th page, every card string is preflighted through `PDFont.getStringWidth` before any page is drawn, and an unencodable character throws `422 UNPRINTABLE_TEXT` up front. If non-Latin names become a real requirement, the fix is to embed a subset font (e.g. `PDType0Font.load(doc, notoSansDevanagariBytes, true)`) behind the same font-construction call site — not to special-case individual strings.
