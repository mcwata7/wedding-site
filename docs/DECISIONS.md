# Decision log

Append-only. Newest entry at the top. One block per decision — the *why*
that neither the code nor `SYSTEM_DESIGN.md` records: rejected alternatives,
constraints, gotchas found the hard way. Always add new entries at the top,
never edit past entries (except to fix a typo) — this keeps concurrent
sessions' additions as simple, non-conflicting git diffs.

Format:

```markdown
## YYYY-MM-DD — Short title
**Context:** what problem/situation prompted this.
**Decision:** what was chosen.
**Rejected:** alternatives considered and why they lost out.
```

---

## 2026-09-05 — Tile styling extends the site-styling theme, not a new mechanism
**Context:** Following the header/site styling controls (below), the user asked for the same
kind of control over the individual "tile" cards on Schedule, Travel, and Things To Do — each
event, hotel, flight, and recommendation currently share one hardcoded look
(`bg-white rounded-lg border border-ink/10`) across four call sites in three page files.
**Decision:** Two more nullable `site_settings` columns (`V23`): `tile_bg_color`,
`tile_border_color` — no font/size fields, since tile text already follows the Site styling
above and a tile has no independent "size" concept the way header/body text does. Reuses every
mechanism `V22` already built: the same `blankToNull` validation branch, the same
`hexToRgbTriplet`/CSS-variable/`<alpha-value>` Tailwind pattern (two new tokens, `tileBg`/
`tileBorder`), the same `ColorField` planner UI component. `tileBorder`'s fallback is `ink`'s own
RGB triplet, so `border-tileBorder/10` reproduces today's `border-ink/10` exactly when unset —
all four tile call sites (`SchedulePage.tsx`'s `<li>`, `TravelPage.tsx`'s `HotelCard`/
`FlightCard`, `ThingsToDoPage.tsx`'s `ThingToDoCard`) needed only a one-line class swap
(`bg-white border-ink/10` → `bg-tileBg border-tileBorder/10`), no logic changes.
**Rejected:** A tile font color/size, mirroring Header/Site exactly — tiles don't introduce any
text that isn't already styled by `site_font_color`/`site_font_size`, so a third font control
would just duplicate the Site section with no independent effect. FAQ's cards were left alone —
the user scoped this to Schedule/Travel/Things To Do specifically.

---

## 2026-09-05 — CORS filter must not register when allowed-origins is empty
**Context:** After adding `WEDDING_CORS_ALLOWED_ORIGINS` support (see the Render deployment entry below), local Docker Compose started 403ing every request. Spring Security's CORS filter, once wired in via `http.cors(c -> c.configurationSource(...))`, rejects any request carrying an `Origin` header that isn't on the configured allow-list — and browsers send `Origin` on same-origin fetch/XHR requests too, not just cross-origin ones. Locally `WEDDING_CORS_ALLOWED_ORIGINS` is unset (empty allow-list), so every proxied request from the nginx-served frontends got 403'd before `authorizeHttpRequests` ran.
**Decision:** `SecurityConfig.securityFilterChain` now only calls `http.cors(...)` when `wedding.cors.allowed-origins` is non-empty. With an empty list the CORS filter is never added to the chain at all, which reproduces the pre-CORS behavior of ignoring `Origin` entirely — correct for the local/Compose same-origin nginx-proxy setup.
**Rejected:** Registering the filter unconditionally with an empty `CorsConfiguration.allowedOrigins` — looks equivalent ("no origins allowed") but isn't: an *inactive* filter ignores `Origin`, while an *active* filter with zero allowed origins actively rejects every request that has one.

---

## 2026-09-05 — Render deployment: Static Sites + CORS over Docker/nginx proxy
**Context:** Needed a public hosting target. GitHub Pages was ruled out (static-only, no backend/DB). Chose Render: one place for the Spring Boot API, Postgres, and both Vite frontends.
**Decision:** Backend on a Render Web Service (Docker, `backend/Dockerfile`, free plan), Postgres on a paid Render database (free tier expires after 30 days — a non-starter for real RSVP data), and both frontends as Render Static Sites (free, no spin-down). Since Static Sites can't run the nginx reverse proxy the local/Compose setup uses, the frontends call the API's absolute URL directly: `VITE_API_BASE_URL` is baked in at Static Site build time (empty locally, so `fetch('/api/...')` and `<img src="/api/v1/media/...">` keep working unchanged through Compose's nginx proxy), and the backend allow-lists the two frontend origins via `WEDDING_CORS_ALLOWED_ORIGINS` (new `SecurityConfig` `CorsConfigurationSource` bean, empty/no-op by default). `render.yaml` at the repo root captures all four services (`wedding-api`, `wedding-guest`, `wedding-planner`, `wedding-db`) as a Blueprint. Declined a persistent disk for `WEDDING_MEDIA_DIR` for now (requires a paid web-service plan) — uploaded planner images don't survive a redeploy/restart until one is added.
**Rejected:** Deploying the frontends as Docker web services that reverse-proxy `/api` to the backend's Render-internal hostname (mirrors Compose almost exactly, no CORS needed) — rejected because it turns 2 free static sites into 2 paid/spin-down services for a personal, low-traffic site, for the sole benefit of avoiding a ~10-line CORS config.

---

## 2026-09-05 — Guest site styling controls + Home "designed image" override
**Context:** The user wanted a planner to be able to restyle the guest site (header/site
font family, color, size, background color) using 10 custom fonts they supplied as a zip
of `.ttf` files, plus a way to fully replace the Home page with one image designed
outside the app, without giving up the existing hand-built Home fields.
**Decision:** 8 nullable `site_settings` columns (`V22`) — `header_`/`site_` ×
`font_family`/`font_color`/`font_size`/`bg_color` — plus `home_design_image_id`/
`home_design_only`. Unlike `site_layout` (`V21`), these have no schema default: null
means "the guest app's built-in look," so the new parse helpers
(`parseFontFamilyOrNull`/`parseFontSizeOrNull` in `InternalDataController.java`) must
preserve null on blank input rather than substituting a default, and the color-column
branch (`blankToNull`) turns a cleared field's `""` into `NULL` — critical because the
guest app's CSS relies on `var(--x, fallback)`, which only falls back when the property
is genuinely *unset*, not empty.

The guest app (`frontend/public/`) had zero runtime-styling mechanism before this —
every Tailwind color/font class was a compile-time literal, and `text-ink`/`bg-paper`
are used with opacity modifiers (`text-ink/70`, `bg-paper/95`) at 55+ call sites.
Tailwind's `rgb(var(--x, <fallback-rgb>) / <alpha-value>)` idiom makes `ink`/`paper`
CSS-variable-backed without touching any of those 55 call sites; the CSS variable must
hold a space-separated "R G B" triplet, not a hex string — a hex string here silently
breaks every opacity-modified class site-wide, not just the one changed
(`hexToRgbTriplet` in `src/lib/theme.ts`, returning `undefined` on anything unparseable
so the Tailwind fallback applies instead of erroring). `site_font_family` is wired the
same way into `fontFamily.display`, but by explicit choice only affects headings/page
titles, not body paragraphs — the 10 fonts are decorative script faces unsuited to
long-form reading. All 8 style variables (plus the root font-size) are set on
`document.documentElement`, not a scoped wrapper element: `rem` (Tailwind's sizing unit)
is always relative to `<html>`, never an ancestor, so `site_font_size` has no scoped
alternative, and `bg-paper`/`text-ink` are applied on `<body>` anyway, above any wrapper
a scoped approach could use. This mutation still only takes effect post-authentication
because it's driven from `useSiteTheme()`, called only inside `Layout`, which never
mounts on `/unlock`/`/i/:qrToken` — those routes' fixed branded look is untouched with
no extra scoping logic needed. The active nav item's color overrides both active and
inactive states together when `header_font_color` is set (rather than leaving active
fixed at the built-in maroon `accent`), since a fixed accent could go unreadable against
a planner-chosen dark header background.

The 10 fonts are bundled as static assets (`frontend/public/public/fonts/*.ttf`,
`@font-face` in `index.css`) rather than uploaded through the media/upload pipeline —
they're a fixed curated catalog the user supplied, not planner-authored content, so
this follows the exact precedent already set by `public/branding/temple-illustration.jpg`
with zero backend/media involvement. Only Regular weight is bundled (the source zip's
two Bold variants — Tangerine, Gwendolyn — are unused, since nothing in the design
renders bold display text).

`home_design_image_id`/`home_design_only` live on `site_settings` (not `site_page`),
following the exact precedent of `hero_image_id`/`hero_tagline`: Home-only fields edited
inside the Home row's Pages-tab modal but physically stored on the singleton settings
row, via the existing `if (editingPage?.slug === 'home')` second-mutation branch in
`SitePage.tsx`'s `savePage`.
**Rejected:**
- A single JSONB "site_theme" column instead of 8 flat columns — `GET /api/v1/guest/
  site/config` is `SELECT *` with no DTO (flat columns reach the guest app for free) and
  `PATCH /site/settings` is a field-wise merge, not a whole-row replace, unlike
  `invitation_card_layout` (JSONB), which needed that shape for cross-field orientation
  validation these 8 fields don't have.
- A SQL `CHECK` constraint enumerating all 10 font-family keys — the font list is a
  frontend asset set expected to grow, and `updateSiteSettings` is the only writer
  (already 400s on an unknown value), so a `CHECK` would only force a migration for
  every future font. `font_size` (`SMALL`/`MEDIUM`/`LARGE`) is a true closed 3-value set
  and does get a `CHECK`, matching `site_layout`'s precedent for a real enum.
- Applying `site_font_family` to body paragraphs too, not just headings — raised as an
  explicit question rather than silently decided, given the fonts' poor legibility at
  paragraph length.
- `home_design_image_id`/`home_design_only` as new `site_page` columns instead — that
  table's generic per-row shape (and existing `image_id`/whitelist) would make them
  technically reachable on every page row while being meaningful on exactly one, and
  `HomePage` would need to defensively handle a hidden/renamed Home row via
  `usePageContent('home')` returning `undefined`.

## 2026-09-05 — Guest site single-page layout: a stored toggle, shared page components
**Context:** The user wanted a second guest-site presentation — one continuous page with
anchored sections instead of a route per tab — without giving up the original multi-page
design, selectable per-wedding.
**Decision:** Added `site_settings.site_layout` (`MULTI_PAGE`/`SINGLE_PAGE`, `V21`), edited on the
planner UI's Site → General tab and read by the guest app via `useSiteLayout()`. In single-page
mode, a new `OnePage.tsx` composes the *same* `HomePage`/`SchedulePage`/`TravelPage`/
`ThingsToDoPage`/`FaqPage`/`ContentPage` components used by the multi-page routes — unmodified —
into `<Section>` wrappers; `PageHeading` picks `h1` vs `h2` via a `HeadingLevelContext` `Section`
provides, so no prop was threaded through five files. RSVP stays routed in both layouts
(`ROUTED_SLUGS`), since it's submitted through rather than read, and a form mid-scroll fights the
anchor model. A legacy path (`/travel`) redirects to its anchor (`/#travel`) rather than 404ing.
Scrolling to an anchor is entirely JS-driven (`useHashScroll`): sections don't exist in the DOM
until `OnePage`'s queries resolve, so the browser's native anchor scroll (and React Router) never
do this for us — `useHashScroll` re-scrolls on every hash change once the page is `ready`,
instantly on the first arrival (deep link/redirect) and smoothly after (nav clicks, back/forward).
Fixing this also required making `GuestAuthContext`'s session rehydration synchronous (lazy
`useState` initializer, not a `useEffect`) — `GuestRoute` reads `isAuthenticated` on first render,
before any effect runs, so the async version redirected to `/unlock` on every hard refresh and
silently dropped the URL's hash in the process; that was a latent bug this feature exposed as a
correctness requirement, not just a nice-to-have.
**Rejected:**
- A `VITE_`-style build flag — needs a redeploy to flip and puts the choice in a developer's
  hands rather than the couple's, unlike every other guest-site presentation setting.
- Duplicating the five pages into dedicated "section" components — guarantees the two layouts
  drift apart as content evolves, for what is otherwise a purely presentational difference.
- Writing the active section back into the URL hash while scrolling (for nav highlighting) —
  `pushState` per section spams the Back button with every section scrolled past; `replaceState`
  fights an in-flight smooth scroll and fires constantly during mobile momentum scrolling.
  Active-item highlighting stays in component state (`useActiveSection`'s `IntersectionObserver`);
  the hash only changes from an explicit nav click.
- A global `scroll-behavior: smooth` — would animate the *initial* landing scroll too, so a cold
  deep link or a legacy-path redirect would visibly scroll past every section to reach its target.

## 2026-08-30 — Bulk guest import: dropped `party_key`, groups rows by `party_name` instead
**Context:** The CSV bulk import (`GuestImportController`) required a `party_key` column — an
arbitrary planner-invented string (e.g. `smith-family`) with no home in the database — purely so
multiple guest rows in one CSV could be attached to the same new `party`. The user asked to drop
it: a party's identity is already auto-generated (`db.uuid()`) at insert time, and asking planners
to invent and consistently retype a second, throwaway key alongside `party_name` on every row was
unnecessary friction. (`verification_question`/`verification_answer` were already required CSV
columns and already write to `party.verification_question`/`verification_answer_hash` on insert —
that half of the request was already satisfied, no change needed.)
**Decision:** Removed `party_key` from `HEADERS`, the missing-column check, and the per-row
required-field check. The `parties` grouping map is now keyed by `row.get("party_name").trim().toLowerCase()`
instead of the old key — rows sharing a party still merge into one `party`, just via the field
planners are already filling in. Case/whitespace-folded (not the raw string) specifically because
removing the explicit key also removes the old safety net against a same-party typo in casing
("Smith Family" vs "smith family") creating two parties by accident; the *stored* `display_name`
still uses the first row's exact original casing. Unchanged: only the first CSV row seen for a
given party contributes `party_name`/`verification_question`/`verification_answer` to the inserted
`party` row — later rows for that party only need to repeat the same `party_name` to be grouped in,
matching the pre-existing (silent-ignore-on-later-rows) behavior for those columns under the old key.
**Rejected:** Keeping `party_key` but auto-filling it server-side from `party_name` (e.g. slugifying)
— adds a derived value with its own edge cases (two different `party_name`s slugifying to the same
key) for no benefit over just using `party_name` directly as the grouping field. Grouping by the
*raw*, non-normalized `party_name` — rejected because it would silently reintroduce the exact
duplicate-party risk the old separate key structurally avoided, with no corresponding upside.

## 2026-08-30 — Wedding Site page cleanup: Content merged into Pages, four unused tabs dropped, structured Travel/FAQ added
**Context:** The planner's Wedding Site page had a Content tab (a single form over `site_settings`
mixing wedding-wide identity — partner names, date, timezone — with per-tab heading/body/image
copy for Home/Schedule/Travel/Things To Do) and a separate Pages tab whose Edit modal held the same
kind of heading/body/image copy for every other `site_page` row. Editing "Travel" copy meant Content;
editing "FAQ" copy meant Pages — two places for one concept, for no structural reason. Separately,
four seeded `site_page` rows (Our Story, Wedding Party, Photos, Registry) were hidden free-text stubs
nobody had ever populated, while the two tabs that actually needed structure had none: FAQ was one
paragraph instead of Q/A pairs, and Travel was one paragraph — `travel_item` had been dropped back in
`V5__things_to_do.sql` with no replacement, so there was no hotel/flight model at all.
**Decision:** `V18__site_content_cleanup.sql` moves per-page `heading`/`body`/`image_id` onto
`site_page` (adding a `heading` column, backfilling from the matching `site_settings` columns for
`home`/`schedule`/`travel`/`things-to-do`, then dropping those eleven now-redundant `site_settings`
columns) so every tab's copy is edited from one place — the Pages screen's Edit modal. `hero_image_id`/
`hero_tagline` stayed on `site_settings` (they're the site-wide hero banner's identity, not a specific
page's copy) but their *editing location* moved into the Home row's Edit modal, alongside that page's
own heading/body, rather than living on a separate General form. The planner's General tab now holds
only wedding-wide settings: partner names, `wedding_start_date`/`wedding_end_date` (a range —
`wedding_date` renamed and a second column added) and `display_timezone`. Our Story/Wedding
Party/Photos/Registry rows were hard-deleted (not just left hidden) since `site_page` has no
`archived` column or delete endpoint and nothing was using them; FAQ was flipped visible. New
`faq_item`, `travel_hotel`, `travel_flight` tables are each shaped like `thing_to_do_item`
(`sort_order`, `archived`, timestamps) so they slot into the existing generic
`TABLES`/`COLUMNS`/`createSimple` resource pattern with no new controller code beyond a few map
entries and read GETs. `travel_flight.duration`/`estimated_cost` are free text, not numeric/currency
columns — planners need to express ranges ("~14h incl. layover", "$900–$1,200 round trip") and the
budget/FX-rate module was removed in `V16` with no plan to revive numeric currency handling for a
one-off use like this.
**Rejected:** Keeping Content and Pages as two tabs with Content deferring to Pages' data (e.g.
Content still showing per-tab fields but reading/writing `site_page` under the hood) — this preserves
the exact two-places-for-one-thing confusion the change set out to fix, just with shared storage
underneath. Leaving the four unused sections hidden rather than deleting them — a planner already had
the Hide toggle available and never used it for these; a half-dead schema of never-populated stub rows
invites the same "why is this here" confusion this log exists to prevent, and readding a page later is
one migration. Modeling flight cost as a `NUMERIC` column — would force a currency assumption (USD?
NPR?) and can't express a range, and there's no existing currency-conversion infrastructure in this
codebase to lean on since `V16` removed it.

## 2026-08-30 — Invitation card redesigned: two-sided, three free-position elements, orientation
**Context:** The user asked to remove every free-text field from the invitation card entirely,
make it two-sided (a front that's pure planner-uploaded artwork, and a back carrying only the QR
code, the invite URL, and the party's display name — "guest names"), give those three elements
full x/y placement (previously text was X-centered-only, Y-configurable), and add a portrait/
landscape orientation setting.
**Decision:** `CardLayout` shrank from a `Map<String,FieldLayout>` of 8 heterogeneous text fields
to three named, typed elements — `QrLayout{x,y,size,color}` and `TextLayout{x,y,size,color}` ×2
(`inviteUrl`, `guestNames`) — since the map's two reasons for existing (validating/iterating 8
similar entries generically, and building a font cache per saved font) both disappeared: `size`
now means mm for the QR and pt for text (so a generic loop would branch on the key anyway), and
font became a fixed code constant (Courier for `inviteUrl`, Helvetica-Oblique for `guestNames`,
matching the prior `partyName` default look) rather than planner-editable — one fewer control, and
`ALLOWED_FONTS`/`UNSUPPORTED_FONT` disappear entirely. Text stays X-centered on its own x (matching
how the QR already center-anchors); Y is the baseline, not a true vertical center — kept as-is and
documented in the UI, since changing it would silently shift every future saved layout and a
baseline is the natural anchor for single-line PDF text anyway. `site_settings.invitation_image_id`
was renamed to `invitation_front_image_id` (it was already all-artwork, so it's the natural front)
plus a new `invitation_back_image_id`; the four now-dead free-text columns
(`invitation_header1`/`invitation_header2`/`invitation_body`/`invitation_footer`) were dropped, not
just deprecated. `invitation_orientation` (`PORTRAIT`/`LANDSCAPE`, `CHECK`-constrained) lives on its
own `site_settings` column, not inside the layout jsonb — it's a property of the physical sheet
shared by both sides, and `CardLayout.validate()` needs it before it can check any position at all.
One migration (`V17__invitation_card_two_sided.sql`) did the rename/drops/new-columns/jsonb-replace
together — splitting it would leave `MediaSeedService`/`CardLayout.validate()` briefly inconsistent
with the schema for no rollback benefit. The plate (the opaque, auto-toned legibility rect behind
the QR) now unions all three back-side elements instead of two, keeping the prior "everything on
the back gets a legibility guarantee" philosophy; its tone now samples the back image's *whole*
average instead of just its top 12% — that heuristic was tuned to `card.jpg`'s specific white
margin, an assumption that doesn't hold for an arbitrary planner-uploaded back image in either
orientation. The QR's own fill color also became planner-editable — an explicit reversal of the
2026-08-30 "Per-field text color" entry below, which rejected exactly this to protect scannability;
see that trade-off's re-reasoning as its own bullet below. The QR's minimum size was separately
raised from a naive 5mm to 20mm in `validate()`, closing a real pre-existing gap: below ~20mm a
realistic invite URL's QR module size drops under `drawQr`'s 0.5mm scan-density floor, so a smaller
saved value validated fine and then 422'd on every render.
**Rejected:** Keeping `hostLine`/`tokenLine`/`footer`/etc. as unused-but-present fields instead of
deleting them — the user asked for *all* fields removed, and a half-dead schema invites exactly the
kind of "why is this here" confusion this log exists to prevent. Scoping the plate to QR+inviteUrl
only (leaving `guestNames` unprotected, since a name is arguably decorative) — rejected in favor of
protecting all three, consistent with how the feature already worked and cheaper than reasoning
through a new asymmetric rule. Inverting the cover-crop transform to sample the *exact* image
region behind the plate for its tone (more correct than a whole-image average) — real scope creep
for this pass; whole-image average is simpler, orientation-agnostic by construction, and good
enough. Making `DEFAULT_LAYOUT` valid in both orientations simultaneously — geometrically impossible
for a design that's meaningfully centered in one aspect ratio (105:148) to also be centered in its
inverse (148:105); the default is tuned for portrait, and orientation switches rely on the
client-side clamp + server-side re-validation described below instead.

## 2026-08-30 — QR module color made planner-editable (supersedes the prior rejection)
**Context:** The "Per-field text color" decision below (same day, filed first) explicitly rejected
letting a planner color the QR or the legibility plate, reasoning that either "would reintroduce
the exact scannability risk the plate exists to prevent." The user's follow-up two-sided-card
request explicitly asked for QR color control anyway, as one of three elements (QR, invite URL,
guest names) that should each get color/position/size.
**Decision:** Honor the explicit request: `QrLayout` gained a `color` field, validated with the
same hex regex as text (`^#[0-9a-fA-F]{6}$`), and `drawQr` fills modules with it instead of a
hardcoded black. The plate stays exactly as protective as before — auto-toned from the back image,
not planner-configurable — so the QR's *backing* is unchanged; only the QR's own ink color is now
in the planner's hands. No automatic contrast-ratio check was added between the two. The live
two-page preview (side-by-side front/back `<iframe>`s, updating ~400ms after each edit) is the
actual safety net: a planner who picks a QR color too close to the plate's tone sees a
disappearing QR immediately, before printing anything.
**Rejected:** A luminance-ratio validation comparing the QR's color against `PLATE_MIN_LUMA` (or
the plate's actual sampled tone) inside `CardLayout.validate()` — the natural place to preserve the
original decision's intent at low cost, except `validate()` is static and runs with no access to
the back image: once at PATCH time (before any image is loaded) and once at the start of `render()`
(before `plateTone()` even runs). A real contrast check could therefore only fire inconsistently —
at render time only, and silently swallowed by the debounced preview's own try/catch, meaning a
planner could Save a bad combination successfully and only discover it was broken on the next PDF
download. That inconsistency was judged worse than no automated check at all, given the live
preview already closes the same gap visually.

## 2026-08-30 — Budget module removed
**Context:** The planner UI's Budget page (categories, contributors, line
items with planned/actual tracking, a category summary view) and its
`budget.csv` report had no other module depending on them. The only other
piece of the feature, `FxRateService`, was a daily scheduled job that
stored exchange-rate snapshots into `fx_rate_snapshot` purely to support
budget currency-conversion reporting; nothing read that table (no endpoint
ever exposed it), so the snapshot history had no consumer either.
**Decision:** Remove the Budget page, its planner-write/read endpoints
(`InternalController`, `InternalDataController`), the `budget.csv` report
endpoint, `FxRateService`, the `wedding.fx.*` config block, and
`@EnableScheduling` (nothing else used `@Scheduled`). `V16__drop_budget_module.sql`
drops `budget_line_item_contributor`, `budget_line_item`, `budget_category`,
`budget_contributor`, and `fx_rate_snapshot`.
**Rejected:** Keeping `fx_rate_snapshot`/`FxRateService` in place in case a
future currency-conversion feature wants rate history — no such feature is
scoped yet, and a live rate lookup (called on demand, nothing stored) is a
better fit for "view the current conversion" than a daily snapshot job with
no reader. Revisit with a fresh design when that feature is actually built.

## 2026-08-30 — Shorter tokens, admin-visible, merged with host into one printed URL line
**Context:** Three related requests: (1) the raw invitation token was only ever shown once, in a
transient modal right after minting ("This token will not be shown again. Save it now.") — missing
it meant re-issuing (rotating, invalidating any already-printed card) was the only way to see it
again; (2) the token itself was ~50 characters (`UUID.randomUUID() + "-" + Long.toUnsignedString(random.nextLong(), 36)`),
minted independently in two places with duplicated `SecureRandom` fields; (3) the printed card drew
the host and token as two separate stacked lines for a guest to read concatenated.
**Decision:** Centralized minting into `DataService.newToken()`: 6 random bytes,
`Base64.getUrlEncoder().withoutPadding()` (alphabet `A-Za-z0-9-_`, no padding), exactly 8 chars,
replacing both independent call sites (`InternalController.invitation()`,
`InvitationCardController.issueMissing()`) and removing their now-dead `SecureRandom` fields. No
collision-retry logic: ~2.8e14 possible values at this app's realistic scale (tens to low hundreds
of parties) makes a collision astronomically unlikely, and `invitation.token_hash`'s `UNIQUE`
constraint means a collision would surface as a loud insert failure, never as two parties silently
sharing a working invite — that's the actual safety net, not just "unlikely." Already-issued
long-format tokens keep working unchanged (hash comparison is format-agnostic; nothing forces
rotation). `InternalDataController.party()`'s SELECT gained an explicit `,i.token` column, and
`PartyDetailPage` now shows it persistently in the invitation-status strip; this is a deliberate,
narrow exception to the "never leak the raw token" invariant (`V4__invitation_cards.sql`, backend
design §12) — that invariant specifically targets `SELECT * FROM invitation` and the generic
`InternalDataController.TABLES` dispatch (both of which risk an unreviewed leak, including into an
`audit_record` before/after snapshot); `party()` is a pure read with no `db.audit(...)` call, and
the added column is one explicit name among several already there, not a blanket exposure — an
admin viewing one party's own token on that party's own page is exactly the access this data
exists for. On the card, `hostLine`/`tokenLine` merged into one `inviteUrl` field (`host + "/i/" +
token`, drawn once, Courier, muted gray) — natural once the token is short enough to read as one
line — via `V15__invitation_card_invite_url_field.sql`, which deletes both old jsonb field paths
and adds the merged one; any per-field customization on the old two fields isn't carried over
(two fields becoming one can't be meaningfully merged), acceptable since the layout feature is only
a few migrations old. `V15` also brought `invitation_card_layout`'s column-level `DEFAULT` up to
date with `V14`'s `color` addition and this merge — that default had already gone stale after `V14`
(no `color` key), harmless today since `site_settings`'s singleton row is only ever created once
(`V3__public_site.sql`), but a live landmine (`CardLayout.validate()` 422s on a missing `color`) if
that ever changed, so worth fixing while already touching this column.
**Rejected:** A collision-retry loop on token minting — added complexity for a risk two orders of
magnitude below what the `UNIQUE` constraint already turns into a safe, loud failure. An
unambiguous alphabet (Crockford base32, avoiding confusable glyphs like `l`/`I`/`1` or `O`/`0`) for
a token that's now printed as part of a human-typeable URL — considered, since the merge into one
`inviteUrl` line makes manual entry more salient, but rejected in favor of the user's explicit
"base64 encoded" request: the QR code remains the primary, redundant way to use the card, and
manual typing is a fallback path, not the intended interaction.

## 2026-08-30 — JDWP debug port on the api container, wired via compose env var not the Dockerfile
**Context:** The `api` container runs `java -jar app.jar` with no way to attach a remote debugger
when the stack is started with `docker compose up`.
**Decision:** Expose JDWP on `5005` (`EXPOSE 5005` in `backend/Dockerfile`, documentation only —
`EXPOSE` doesn't publish anything by itself) and enable it via `JAVA_TOOL_OPTIONS` set in
`compose.yaml`'s `api.environment`, plus `ports: ["5005:5005"]`. `suspend=n` so the app still
starts and serves traffic with no debugger attached — attaching is opt-in, not a precondition for
the container to come up. Scoped to just `api`: it's the only container running a long-lived JVM
process a standard debugger protocol can attach to; `db` is stock Postgres, and `web-internal`/
`web-public` are static builds served by Nginx with no runtime Node process to attach to.
**Rejected:** Baking the `-agentlib:jdwp` flag into the `Dockerfile`'s `ENTRYPOINT` instead of
`JAVA_TOOL_OPTIONS` in compose — would open an unauthenticated debug port on every environment that
runs this image, not just local/dev compose. `JAVA_TOOL_OPTIONS` is picked up automatically by any
`java` invocation with zero `ENTRYPOINT` change, and keeps the debug wiring in the one file
(`compose.yaml`) that's understood to be the local/dev stack.

## 2026-08-30 — Per-field text color added to the invitation card layout
**Context:** Card Design already let a planner set each text field's font/size/Y (see the
2026-08-29 layout entry below). The card's color was still fixed — black for every field except
the muted-gray host/token credential lines — with no way to pick up an accent color (e.g. to match
an uploaded background like the maroon `card.jpg`) without a code change.
**Decision:** Add `color` (a `#rrggbb` hex string) as a fourth property on each `FieldLayout` inside
`CardLayout`, right alongside font/size/y — same storage (`site_settings.invitation_card_layout`
jsonb), same validation path (`CardLayout.validate()`, now also checking `color` against
`^#[0-9a-fA-F]{6}$`), same render path (`InvitationCardRenderer.parseColor` converts the hex to the
0-1 RGB floats `PDPageContentStream.setNonStrokingColor` needs). `V14__invitation_card_field_color.sql`
backfills a `color` key into every already-stored field object via chained `jsonb_set(path, value,
true)` calls — `create_missing=true` only adds the new key, so an already-customized layout keeps
its font/size/y untouched. Defaults match the pre-existing hardcoded look exactly (`#000000` for
regular text, `#737373` for `hostLine`/`tokenLine`, the same value the old `gray=0.45` constant
produced) so this migration is a no-op visually until a planner changes something. The planner UI
pairs a native `<input type="color">` swatch with a plain hex text `Input` bound to the same value,
so a planner can either pick visually or paste an exact brand hex.
**Rejected:** Extending color to the QR modules or the legibility plate too — deliberately scoped to
text only. The plate's color is derived from the background image's own sampled tone specifically so
it blends in and stays legible against *any* uploaded background; letting a planner override it (or
the QR's black-on-light contrast) would reintroduce the exact scannability risk the plate exists to
prevent, for a feature (color) that's purely cosmetic on those two elements. Storing color as three
separate int/float columns (r/g/b) instead of one hex string — rejected as inconsistent with how
color is authored and read everywhere else in this stack (CSS hex, the HTML `<input type="color">`
element's own value format, hand-typed brand colors) — a hex string needs no client-side packing/
unpacking on either side of the API.

## 2026-08-30 — Outbound Slack RSVP notification: one message per update, after-commit, incoming webhook
**Context:** Planners had no live signal when a guest's RSVP changed short of opening the planner
UI. A Slack incoming-webhook URL was added to `.env` (`SLACK_WEB_HOOK`) to push a message on every
RSVP status change (`GuestController.rsvp`, `InternalController.manualRsvp`), including a change
back to `PENDING` — a planner wants to know if a guest un-RSVPs, not just when they first respond.
An earlier version of this feature deduplicated to one message per party (via a
`party.slack_notified_at` claim column) on the assumption that a multi-guest household RSVPing
one-by-one would otherwise spam the channel; that requirement was dropped — every status change is
now its own message, and the claim column/migration were removed since nothing depended on them yet.
**Decision:** `SlackNotifier.rsvpRecorded(rsvpId)` looks up the single changed `rsvp` row (guest,
party, status, note) and posts one message, no dedup. The payload has no top-level `text` — only
two `blocks` (using Slack's actual `blocks` key — the originally-specified `"block"`, singular, is
silently ignored by Slack's webhook API and would render nothing): a `header` block whose
`plain_text` is `"RSVP: {name} from {party} party responded {STATUS}"`, with `STATUS` the raw
`rsvp.status` value (`ATTENDING`/`DECLINED`/`PENDING`/`WAITLISTED`) rather than a friendlier word —
an initial version mapped it to Yes/No/Pending/Waitlisted, but the exact wanted format spelled out
the enum verbatim — and a `section` block whose `mrkdwn` text is always `"*Notes*: "` with
`rsvp.note` appended (blank when there is none), so a guest's or planner's note surfaces in Slack
without opening the planner UI. The event name was dropped from the message entirely in the same
correction. The POST is still deferred to `TransactionSynchronizationManager.afterCommit` when
the caller is transactional (`GuestController.rsvp`) so a rollback can't announce an RSVP that
never happened; `InternalController.manualRsvp` isn't transactional, so it posts inline.
**Rejected:** Keeping the once-per-party gate — no longer a requirement, and it actively hid
useful signal (a guest flipping from Yes to No, or a planner correcting a status, produced no
message once the party had already been "claimed"). Building this as a Slack app (there's an
untouched Bolt-JS starter template at `rsvp-manager/` in the repo) instead of a plain incoming
webhook — Bolt is for building interactive Slack apps (slash commands, socket-mode event
listeners, a second hosted process); this integration is one-way, fire-and-forget backend-to-Slack,
which an incoming webhook does with zero extra infrastructure.

## 2026-08-29 — Full per-field invitation card layout control; jsonb decoding centralized in DataService
**Context:** Every text element on the printed invitation card (headline, couple names, date, body,
party name, footer, host/token credential lines) and the QR code had its font, size, and position
hardcoded as Java constants in `InvitationCardRenderer`. A new template, `card.jpg`, was meant to
become the default background, but its hand-drawn QR placeholder box sits in a different spot than
the old hardcoded QR position — and pixel-measuring it showed the box occupies card-space
y≈[4.3, 34.3]mm, leaving no room below it for the footer/host/token lines that used to sit there
(they had to move above the QR in the new default instead, a real bug caught only by rendering and
visually inspecting the result, not by code review or the type checker).
**Decision:** Replace the single `headline` field with `header1`/`header2`, and add one
`site_settings.invitation_card_layout` `jsonb` column holding a `QrLayout{x,y,size}` plus a
`Map<String,FieldLayout{font,size,y}>` for all 9 text fields. Text stays X-centered at the card's
true center (52.5mm) — only the QR gets a free X, since repositioning a line of text horizontally
without breaking its centering is a much rarer need than repositioning a 2D graphic. `QrLayout.y` is
now the box's **center** (previously a bottom edge) — anyone touching `drawQr` again needs to know
this or the QR silently shifts by half its size. The legibility plate behind the QR (added in the
prior entry below) became a padded union of the QR box plus the footer/host/token lines' *measured*
extents, since all four can now move independently and a fixed rect can no longer guarantee
coverage. Decoding `jsonb` columns (Postgres hands them back via JDBC as `org.postgresql.util.PGobject`,
not a plain value) was centralized once in `DataService.one()`/`many()` rather than at each `SELECT *`
call site (`site_settings` is read in at least four places) — every caller gets usable nested Java
data for free, and `db.audit()`'s snapshot no longer risks serializing a raw `PGobject` wrapper into
the audit trail. Layout validation (font ∈ an allowlisted Standard-14 set, size/position bounds) is
one static `InvitationCardRenderer.validate()` method, called both at render time and inside the
`PATCH /site/settings` handler, so a bad value 422s on save rather than surfacing later as a broken
print run. A new `POST /invitation-cards/preview.pdf` endpoint renders a candidate (unsaved) layout
against a sample card, inline, so the planner UI can show a live preview while tuning 30+ font/size/
position inputs — without it, that form would be effectively unusable.
**Rejected:** Letting the QR's X also drive the credential lines' X (auto-following it off-center) —
rejected in favor of the simpler fixed-center behavior, surfaced as inline help text near the QR's X
input rather than silently coupling two independently-editable controls. Storing each field's
font/size/position as its own flat `site_settings` column (27 columns for 9 fields × 3 properties)
instead of one `jsonb` blob — rejected as unwieldy for the `SETTINGS_COLUMNS` allowlist pattern and
for the frontend form, which already treats the whole design as one object. A fixed-floor autofit
minimum per field (the pre-existing hardcoded pairs, e.g. couple-names 17→11) — rejected once size
became planner-configurable, since a fixed floor like `11` is nonsensical if the planner sets the
starting size below it; replaced with a proportional floor (`max(size*0.6, 4.5)`).

## 2026-08-29 — Invitation card image slot repurposed as a full-bleed background
**Context:** The printed A6 invitation card's one image slot
(`site_settings.invitation_image_id`) was drawn contain-fit into a small
46×44mm box near the top of an otherwise white card — it read as a logo or
inset illustration, not as the card's design. A new save-the-date artwork
(a full cream field with a decorative border, meant to sit behind the whole
card) needed a home, and adding a second slot for it would leave a card with
two independent, easily-conflicting image concepts.
**Decision:** Repurpose the existing slot: `InvitationCardRenderer` now
cover-crops the image (uniform scale, centered, overflow clipped) to fill
the full bled page, then draws all text and the QR on top. Because the QR
(and the token/URL lines below it) must stay scannable over *any* uploaded
image — including a dark one — the renderer samples the average color of the
image's top 12% (its "paper" field, assuming the crop leaves that visible)
and draws an opaque rounded plate behind the QR and bottom text lines,
blended toward white until its luminance clears a floor (0.82). Everything
else — the QR encoding itself, the artwork content-type restriction to
JPEG/PNG, the `422 UNPRINTABLE_TEXT`/`QR_TOO_DENSE` guards — is unchanged.
`V11__invitation_card_background.sql` clears the column only where it still
points at the old seeded default (Himalayas line drawing), so
`MediaSeedService` reseeds it with the new save-the-date background on next
boot without touching any planner's own choice.
**Rejected:** A second, independent background column, so both the old
inset artwork box and a new background could coexist — rejected because the
card's design wants one coherent image, not two independently-managed
layers a planner has to keep in sync. Stretch-to-fill (non-uniform scale) to
preserve every pixel of a square source's border — rejected because a
~1.4× vertical stretch of the artwork's illustrated elements (pagoda, lion)
is more visually wrong than a symmetric ~29% crop off the left and right. A
uniform translucent white wash over the whole card for legibility, instead
of a plate scoped to just the QR/text region — rejected because it mutes
the background everywhere, including the empty field where nothing needs
protecting.

## 2026-08-27 — Same-UUID migration to merge accommodation_property/room into venue/venue_room
**Context:** `venue`/`venue_room` (added for cost comparison) and
`accommodation_property`/`accommodation_room` (pre-existing, for booking)
had converged into the same real-world concept — the wedding venue is the
hotel. `accommodation_property`'s columns were already a strict subset of
`venue`'s; `venue_room` (room type + count, for quoting) and
`accommodation_room` (one physical numbered room) differed only in whether
a specific unit was identified.
**Decision:** Add a nullable `room_number` + `UNIQUE(venue_id, room_number)`
to `venue_room` so one row shape covers both a room-block quoting entry (no
number) and a specific bookable room (numbered) — same table backs both
uses. Migrate by copying `accommodation_property`/`accommodation_room` rows
into `venue`/`venue_room` **reusing each row's original `id`**, then
retargeting the two inbound FKs (`accommodation_assignment.room_id`,
`guest.room_assignment_id`) to `venue_room` — zero row rewrites, since every
existing FK value stays valid under the new target table. Verified against
the live dev DB (1 property, 1 room, 0 assignments) end-to-end before and
after.
**Rejected:** Allocating new UUIDs for the migrated rows and rewriting every
referencing FK value — strictly more failure-prone for no benefit, since the
UUID spaces were already disjoint. Also rejected keeping the two entity
pairs separate and just cross-linking them — planners would still have to
enter every hotel and room type twice.

## 2026-08-27 — Fixed a live 500 on accommodation assignment creation
**Context:** While rewriting `InternalController.assignment()` to retarget
`room_id` at `venue_room`, found that its INSERT unconditionally referenced
`:party_id`/`:guest_id`/`:coverage_notes`, but `params(in)` only binds keys
present in the request body — and the Assignment form never sent `guest_id`
at all. Confirmed independently: the live dev DB had zero
`accommodation_assignment` rows despite the create UI being fully wired up.
**Decision:** Explicitly bind all three optional keys (defaulting to `null`
when absent) after building the parameter source, in the same change that
touched this method for the room retarget. The existing
`cast(:party_id as uuid)`/`cast(:guest_id as uuid)` wrapping already makes a
bound `null` resolve correctly; Postgres infers `coverage_notes`' type from
the INSERT's target column for an unspecified-type null parameter.
**Rejected:** Filing it as a separate bug fix — the exact method and lines
were already being rewritten for the merge, and leaving a freshly-touched,
known-broken path unfixed would just reintroduce it as a "why does this still
500" surprise later.

## 2026-08-26 — Guests cannot self-waitlist
**Context:** Events have capacity; RSVPs can exceed it.
**Decision:** When a guest RSVPs "attending" to a full event, the server
auto-sets status to `WAITLISTED` server-side. Guests never choose waitlist
status directly — only `ATTENDING`/`DECLINED`/`PENDING` are guest-settable.
**Rejected:** Letting guests opt into a waitlist explicitly — adds a
guest-facing state with no behavioral difference from an auto-waitlist, and
risks guests intentionally waitlisting to jump a future capacity increase.

## 2026-08-26 — Guest JWT kept in memory, not localStorage
**Context:** Guest and planner sessions both use bearer JWTs.
**Decision:** `AuthContext`/`GuestAuthContext` hold the token in memory only
(React state), not `localStorage` or cookies.
**Rejected:** `localStorage` — persists across tabs/reloads but is readable
by any injected script (XSS blast radius), and guest tokens are already
short-lived (2h) so reauth-on-refresh is an acceptable tradeoff.

## 2026-08-26 — No ORM; hand-written SQL in DataService
**Context:** Needed a data access layer for a small, well-understood schema.
**Decision:** Spring Data JDBC (`NamedParameterJdbcTemplate`) with SQL
written directly in controller/service methods, wrapped by `DataService`'s
`one`/`many` helpers. No repository interfaces, no entity mapping layer.
**Rejected:** JPA/Hibernate — the extra abstraction (entity lifecycle, lazy
loading, cache invalidation) buys little for a schema this size and hides
the exact SQL running, which matters for the planner UI's ad hoc reporting
queries.

## 2026-08-26 — Event times stored UTC, presented in Asia/Kathmandu
**Context:** All wedding events happen in one timezone (Kathmandu), but the
planner and some guests may be elsewhere.
**Decision:** Persist `starts_at`/`ends_at` as UTC timestamptz; convert to
`Asia/Kathmandu` only at presentation (API response formatting / frontend
display), never store local time.
**Rejected:** Storing local wall-clock time — breaks the moment a guest's
browser timezone differs from Kathmandu, and complicates any future
multi-timezone event.

## 2026-08-29 — rsvp denormalizes party_id to get an eligibility FK
**Context:** rsvp rows previously had no relationship to `event_eligibility`
in the schema — nothing stopped an rsvp row from existing for a party that
was never (or no longer) invited to that event. Adding a guest to an
already-invited party, or importing guests via CSV, created no rsvp row at
all (the only insert path was the eligible-parties endpoint's one-time
loop); archiving a guest left their rsvp counting toward capacity/attendance
aggregates indefinitely.
**Decision:** `V10__rsvp_party_invite_integrity.sql` adds `rsvp.party_id`
(copied from `guest.party_id`) and a composite FK
`rsvp(event_id, party_id) REFERENCES event_eligibility(event_id, party_id)
ON DELETE CASCADE`, so revoking a party's eligibility cascades its rsvp rows
away automatically. `DataService.syncPartyRsvps(partyId)` is the single
place that reconciles rsvp rows against `event_eligibility × active guests`
on the insert side (guest creation, CSV import, archiving, granting
eligibility all call it) — see backend design §12.
**Rejected:** Deriving the eligibility check at query time (join through
`guest.party_id` on every read) instead of storing `party_id` on `rsvp` —
works for reads but can't express a FK, so the "no orphan rsvp" invariant
would depend on every write path remembering to check it rather than the
database enforcing it once.

## 2026-08-29 — RSVPs page folded into Parties & Guests
**Context:** The planner UI had a standalone `/rsvps` page: a flat,
cross-party table of every guest×event RSVP. It existed independently of
`/parties`, even though an RSVP only makes sense in the context of its
party's invitation.
**Decision:** Remove the `/rsvps` route and nav item. The same table,
edit modal, and status counts now render on `PartyDetailPage` as a guests ×
events matrix, scoped to one party, with invite/un-invite actions on the
event columns replacing the old cross-party "add eligible party" flow that
lived only on the Events page.
**Rejected:** Keeping both — a per-party matrix and the old cross-party
table as a second view. Two places to change an RSVP status invites drift
and doesn't match how the data is actually invited (party-first); a planner
who needs a cross-event view can still filter by event from Reports'
attendance.csv export.

## 2026-08-31 — Drop per-event invitations; every party attends every event
**Context:** Planners had to explicitly grant `event_eligibility` per
party per event (Invite/Un-invite on `PartyDetailPage`, an Eligibility
modal on `EventsPage`) before any rsvp rows existed for that pair — a new
party or a new event started invited to nothing until someone clicked
through the UI. That granularity was never needed: every party attends
every event; only the per-attendee-per-event *response* varies. Planners
still need per-guest per-event RSVP control (`PUT /internal/rsvps/{id}`),
which is unaffected.
**Decision:** Keep the data model exactly as `V10` left it —
`event_eligibility` and `rsvp`'s composite FK to it stay — but stop
treating eligibility as a planner decision. `DataService.syncRsvps()`
(replacing `syncPartyRsvps(partyId)`) now first maintains
`event_eligibility` as an **insert-only** full cross-product of every
party × every event (`ON CONFLICT DO NOTHING`, never deletes), then
reconciles `rsvp` against `event_eligibility × active guests` as before.
It runs on every path that changes any of the three inputs: party
creation, event creation, guest creation/archive, and CSV import.
`V20__universal_event_eligibility.sql` is a data-only migration (no DDL)
that backfills existing parties/events the same way. The
`POST`/`DELETE /events/{eventId}/eligible-parties/{partyId}` endpoints,
their frontend hooks, and the Invite/Un-invite/Eligibility UI are removed
outright. Because eligibility is now insert-only, archiving an event no
longer cascades away its rsvp rows — `GuestController.events` and
`InternalDataController.party` both gained an explicit `NOT e.archived`
filter to keep archived events out of guest- and planner-facing reads
instead, which also fixed a pre-existing gap where the guest `/events`
endpoint had no archived filter at all.
**Rejected:** Dropping `event_eligibility` and the FK entirely and
deriving "which events exist for this party" at query time — the data
model was explicitly kept unchanged for this task, and the FK still does
useful work (it's what stops an rsvp row from outliving its event or
party). Also rejected: reconciling one party or one event at a time
(mirroring the old per-party scoping) — at this app's scale (hundreds of
parties × a handful of events) a full reconcile is trivially cheap and
removes an entire class of "this write path forgot to sync" bugs, since
every write that changes eligibility's inputs now converges to the same
correct state regardless of which one it was.

## 2026-08-31 — Removed the invitation card's legibility plate
**Context:** The invitation card back (`V17`) drew an opaque, auto-toned
"plate" rectangle behind the QR, `inviteUrl`, and `guestNames` elements so
all three stayed legible over any planner-uploaded back artwork — see the
"two-sided card redesign" and "QR color reversal" entries above, both of
which treated the plate as a deliberate, code-owned safety net. The user
asked to remove the background behind those three elements outright.
**Decision:** All three elements now render directly over the back
artwork with nothing drawn behind them. `InvitationCardRenderer` drops
`drawPlate`, `plateTone`, `textBoxMm`, `roundedRect`, `clamp`, and
`PLATE_MIN_LUMA` entirely — dead code once nothing calls them. A planner
is now solely responsible for choosing element colors/positions with
enough contrast against their own uploaded artwork; the live front/back
preview (`CardDesignSection.tsx`) remains the way to catch a bad choice
before printing, same as it already was for the QR's planner-editable
color. `InvitationCardRendererTests.qrStaysScannableOverADarkBackground`
still passes without the plate (ZXing's adaptive binarizer tolerates the
test's near-black-on-black case), but its docstring was corrected — it no
longer describes a guaranteed safety net, since none exists after this
change.
**Rejected:** Keeping a minimal automatic contrast check (e.g. rejecting a
QR color too close to a sampled tone) in `CardLayout.validate()` in the
plate's place — validation runs before any image is loaded (both at PATCH
time and at the start of render), so it has no back-image tone to check
against, the same access-order problem noted when the plate's own
contrast check was rejected in the QR-color entry above.

## Guest nav: `safe center` instead of `justify-center` on the scrollable header

**Context:** On a real phone viewport (~375px) the guest header's six nav
items exceed the row's width, so the row's `overflow-x-auto` engaged. With
`justify-content: center` the *overflowing* flex line is centered too, so
the excess is split across both ends and the first/last item sit outside
the scrollport's reachable scroll range: the nav rendered already clipped
at both edges, and "Home" could not be scrolled back into view at any
scroll position. A visible scrollbar track sat under the header as well.
The bug was invisible on desktop and unreachable via a resized browser
window (Chrome enforces a ~490px minimum window width) — it reproduces
only in a genuinely narrow viewport, e.g. an iframe sized to 375px.
**Decision:** The row keeps `overflow-x-auto` but uses
`justify-content: safe center` (`.nav-scroll`, `src/index.css`). `safe`
falls back to start-alignment exactly when overflow occurs — the only case
that was broken — while the fits-on-one-line desktop case stays centered
and byte-identical. The scrollbar is hidden (`scrollbar-width: none` +
`::-webkit-scrollbar`) and replaced with a `mask-image` fade on whichever
edge still has content past it, toggled by `useOverflowFade`
(`src/lib/scroll.ts`) via `data-fade-left`/`data-fade-right`. A bare
scrollbar track under a script-font nav read as a rendering artifact
rather than an affordance; the fade is the cue that more tabs exist.
**Rejected:** (a) Dropping `justify-center` outright — fixes the clipping
but left-aligns the nav on desktop, changing the look everywhere to fix a
phone-only bug. (b) `flex-wrap` onto a second row — no scrolling at all,
but a taller sticky header eats vertical space on exactly the small
screens it targets, and `Section`'s `scroll-mt-*` offsets are sized for
today's single-row header. (c) A hamburger menu below a breakpoint — the
cleanest single-line result, but it introduces open/close state and a menu
idiom this app uses nowhere else, for six short tabs that do fit once they
can actually scroll.

## Guest login by name, with a long-lived persisted session

**Context:** Guests used to enter their invitation's QR token (or scan it
at `/i/:qrToken`) before answering the party's verification question. In
practice the code is one more opaque thing to lose, retype, or scan; the
verification answer was always the real access factor.
**Decision:** `/unlock` step one takes the guest's **own name**.
`AuthController.resolveParty()` normalizes it (trim, collapse whitespace,
lowercase) and matches `first_name || ' ' || last_name` across active
guests of unarchived parties holding a live, non-`CLOSED` invitation,
falling back to first name alone when the full-name match is empty. It
backs both `/guest/invitations/lookup` and `/guest/sessions`, so the two
steps can never disagree about which party is being unlocked. Zero matches
→ `404 GUEST_NOT_FOUND`; matches spanning more than one party →
`409 AMBIGUOUS_NAME`. The guest token now persists in `localStorage`
(was `sessionStorage`) and the backend's `guest-session-minutes` goes
`120 → 43200` (30 days), so a guest checking the site over the months
before the wedding re-verifies roughly never.
**Consequences:** A name is public-ish information, so the security model
now rests entirely on the bcrypt-hashed verification answer — planners
should pick a question only the invited party can answer. The invitation
token still exists and is still printed on cards, but is no longer an
entry credential: `/i/*` redirects to `/unlock` so already-mailed cards
don't 404. A `localStorage` session outlives closing the tab, so a shared
or lost device stays authenticated until the token expires — accepted,
since the guest site holds no PII.
**Rejected:** (a) Guessing on an ambiguous name (e.g. picking the first
match) — would show one party's verification question to a different
party's guest. (b) Keeping the code as an optional second path — two entry
forms to explain and maintain for a code we've decided isn't a credential.
(c) A short token plus silent refresh — real complexity (refresh tokens,
rotation) to protect content that is deliberately low-sensitivity.

## Brute-force protection on the guest verification answer

**Context:** With login by name (see the entry above), the identifier in
front of the gate is public-ish and the only real credential is one
low-entropy answer ("what street did we meet on?"). Unlimited retries
would make that answer guessable in minutes.
**Decision:** `GuestLoginThrottle` (`service/`), backed by
`guest_login_throttle` (`V24`), one row per party created lazily on the
first attempt: **5 answers per rolling minute** → `429 RATE_LIMITED`;
**10 consecutive failures** → 5-minute lock, re-arming on every further
multiple of 10 → `429 TEMPORARILY_LOCKED`; **30 consecutive failures** →
`403 ACCOUNT_LOCKED`, cleared only by
`POST /api/v1/internal/parties/{id}/unlock`, which `SecurityConfig`
restricts to `ADMIN` (listed ahead of the general `internal/**` rule so it
narrows it). A correct answer resets all three counters.
`/guest/invitations/lookup` calls `assertNotLocked()`, a read-only check
that consumes no attempt, so a locked guest learns why at the name step.
**Consequences:** Counting is **per party**, not per guest: a party shares
one answer, so a per-guest counter would multiply an attacker's budget by
the party size — the cost is that one guest's fumbling locks out their
whole party, which is the same blast radius as the shared answer itself.
The lock is also a denial-of-service handle: anyone who knows a guest's
name can lock that party out for 5 minutes, or permanently with 30 tries.
Accepted deliberately — a locked-out guest can call the couple, whereas a
brute-forced answer is silent. The planner UI shows the lock state on the
party detail page so the recovery path is visible.
**Rejected:** (a) Keeping the counters in memory — free, but reset by
every deploy and per-instance, so it would be worth roughly nothing on a
two-instance Render deploy. (b) Making the throttle methods
`@Transactional` — actively wrong here: each one increments a counter and
then throws on it, so the rollback would erase the increment and grant
unlimited attempts. Single-statement atomic `UPDATE ... RETURNING`s give
the concurrency safety a transaction would have. (c) Limiting by IP rather
than by party — the wrong unit for a shared-answer credential, trivially
sidestepped from a phone on cellular, and it would punish whole households
behind one NAT. (d) A CAPTCHA — a third-party dependency and a new failure
mode on a site whose guests skew older and non-technical.
