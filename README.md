# BOSS — internal Airtable-style platform

Next.js 16 (App Router) + React 19 + TypeScript, backed by PostgreSQL. BOSS is our own replacement for the
Airtable base: tables with typed fields, eight kinds of view, forms, a sidebar the team can organize, and
records that are stored in the database (not in the browser).

## Run

```bash
npm install
cp .env.example .env                # set DATABASE_URL (PostgreSQL)
npm run db:migrate                  # schema + definitions + one-time backfills; safe to run on every deploy
npm run dev                         # http://localhost:3000
npm run build && npm start          # `start` runs the migration first
npm run lint                        # tsc --noEmit
npm test                            # unit tests; integration tests require TEST_DATABASE_URL on localhost
```

`DATABASE_URL` is **required**: every table screen reads and writes PostgreSQL. Node 20+.

CI runs the dependency audit, TypeScript check, unit and PostgreSQL integration tests, and a production
build on Node 24. Integration tests use a disposable local PostgreSQL service, never production credentials.
Locally, set `TEST_DATABASE_URL=postgres://test_user:password@127.0.0.1:5432/postgres` only for an isolated
test server with CREATE DATABASE rights. Remote test URLs are rejected; `DATABASE_URL` is ignored by tests.
The tests create and drop uniquely named `boss_test_*` databases, not the database in the URL.
The integration tests create and drop their own throwaway database, so the URL needs `CREATE DATABASE` rights.

Browser end-to-end checks (Playwright for Python, Chromium):

```bash
DATABASE_URL=postgresql://… sh qa/fresh-db.sh     # DROPS and recreates the database: test databases only
sh qa/restart-app.sh                              # starts the production build on :3100
BOSS_URL=http://localhost:3100 python3 qa/base-e2e.py          # tables, views, sidebar, records, sections
# optional second instance to test server-side filtering with a tiny page size:
BOSS_SERVER_QUERY_THRESHOLD=5 BOSS_SERVER_PAGE=6 npx next start -p 3101 &
BOSS_URL=http://localhost:3100 BOSS_URL_SERVER=http://localhost:3101 python3 qa/e2e-update2.py   # create menu, codes, voucher document, Forms style, filters
```

The older `qa/interact.py`, `qa/e2e-browser.mjs` and the screenshot-diff scripts target the previous
hand-built screens and are **not maintained**.

## Tabs

Profiles · Categories · Folios · Actions · Vouchers · Transactions · Items · Forms · Concepts · Capabilities · Leads.

Removed on request: **BOSS, Packet, Accounts, Registries** (screens, seed data and images deleted; their rows in
the database are untouched) and **AIS** (out of the navigation; its routes still exist but nothing links to them).

## How it works

```
src/lib/base/            shared engine: types, field metadata, filter/sort/group/search, validation,
                         sidebar layout logic, view defaults, table definitions (definitions.ts)
src/server/base/         store.ts (all database access), api.ts (routes), migrate.ts (idempotent migration)
src/app/api/base/        HTTP entry point for the engine; api/files/:id serves uploaded attachments
src/components/base/     TableApp (shell), TableProvider (state), Sidebar, Toolbar, RecordEditor, FieldEditor,
                         views/ (Grid, Calendar, Gallery, Kanban, Timeline, List, Gantt, Form)
src/components/base/{vouchers,items}/   Voucher QR + Bill of Lading, stock adjustment
db/schema.sql            additive schema (existing tables are never altered or dropped)
```

Data model (all in the existing database):

| Concept | Where | Notes |
| --- | --- | --- |
| Table | `boss_sections` (slug) | existing |
| Record | `boss_records.data` (JSONB, keyed by field key) | existing; legacy keys are kept |
| Field | `boss_fields` | type, options, required, primary. Renaming never changes the key |
| View | `boss_views` | type + saved settings (filters, sort, grouping, hidden fields, widths, per-type settings) |
| Section (folder) | `boss_nav_sections` | named group of views; deleting one only moves its views back to the sidebar |
| Favorites | `boss_favorites` | per user; views and records |
| Attachments | `boss_files` | bytes in PostgreSQL, served at `/api/files/:id` |
| Autonumbers | `boss_counters` | race-safe |
| One-time backfills | `boss_migrations` | so a backfill never runs twice |

Views of one table share the same records: changing a record in the Kanban shows in the Grid immediately, and
each view's filters, sort, grouping, hidden fields, column widths and field choices (date field, cover, stack
field, form fields…) are saved with the view. Locked views, and other people's personal views, can be used but
not changed (changes apply for that visit only).

### Automatic codes

Text fields can be marked `sequence` (see `definitions.ts`): Actions **Code** (`A-4771`), Leads **Lead ID** (`L-4097`) and
Transactions **Trans** (`04105`). The server assigns the next code when a record is created: one more than the highest
number in use (never the record count), remembered in `boss_counters` so a deleted record's code is not reused, inside
the table's write lock so simultaneous creates get different numbers, and backed by a unique index
(`boss_seq_<table>_<field>`). The side modal shows the next code immediately (`GET /tables/:t/next/:key`); it is not
reserved. A code sent by a client is ignored and an existing code cannot be changed.

### Voucher PDF

The Vouchers screen shows the **voucher document** of the selected voucher: the default template
(`public/vouchers/template/Voucher_Template.png` / `.pdf`, as supplied) with that voucher's text drawn on it, using the same
Saira fonts as the sample vouchers. It redraws as soon as you click another row, pick another voucher in the panel, or edit
a voucher. "Full size" opens a large view with Print. The app does **not** generate, store, upload or replace voucher PDFs.

Where the text comes from (`src/lib/base/voucherDocument.ts`): Voucher number (ID + Form), Accrue, Form Title, Status (the pill),
Issued / Perform (codes of the two parties), Reference 1 / 2, Via, Resource, Tracking #, Notes, Manifest (one row per line) and QR.
The wording that depends on the Form (top title, party labels, the L / R mark, terms of trade) and the names and addresses for known
codes (FEMA-HQ, LLG, QUOTE, DC-GRC / ATL / TRC / PRC, carriers SAIA and TQL) are reference text read from the sample PDFs
(`src/data/voucherDirectory.ts`). A voucher can override it with its own optional columns (Vendor Account / Consignee,
Operated By / Ship To, Deliver Via Phone 1 / 2, Terms of Trade, Manifest of Order, Pack Details): the document prefers the row.
Layout numbers are in `src/components/base/vouchers/voucherLayout.ts`; `qa/voucher-harness/run.sh` renders the real component in a bare
page for checking it against the template and the sample PDFs.

### Filtering

Every view type except Form shares one filter panel (`FilterPanel.tsx`). Operators depend on the field type; conditions
combine with and / or; active filters show as removable pills; filters are saved with the view. Small tables are filtered in the
browser. Above `BOSS_SERVER_QUERY_THRESHOLD` records (default 3000) the server filters, searches, sorts and pages
(`POST /tables/:t/query`, `src/server/base/recordQuery.ts`, parameterized SQL) and the browser shows a “Load more” bar.

### What each view needs

| View | Needs | If missing |
| --- | --- | --- |
| Grid | – | – |
| Calendar | a date field | the view offers to add one |
| Gallery | optional attachment field for the cover | initials are shown |
| Kanban | a single-select field | the view offers to add one |
| Timeline / Gantt | a start date (end date optional) | the view offers to add one; Gantt dependencies use a link field to the same table |
| List | – | – |
| Form | editable fields | choose visible / required fields in the form settings |

### Field types

Single-line text, long text, number (integer / decimal / currency / percent), date, checkbox, single select,
multiple select, attachment, URL, email, phone, link to another record, autonumber, and a small whitelist of
computed fields (voucher number offset, stock status, “folios in this category”). No expressions are evaluated.

### Relationships

- **Folio → Assignee** links to a profile that is a **team member** (`Team` checked). Only team members are
  offered; an existing link stays valid if the person later leaves the team.
- **Folio → Category** links to a category record, so a new category is available in Folios immediately.
- Deleting a profile or category clears the link in other records (the response says how many).
- The previous text values (`cord`, `category`, `group`) are **kept in the record**; an unlinked Assignee or
  Category still shows its old text, muted, until it is linked.

## API

Browser API (same-origin, session cookie), all under `/api/base`:

| Route | Purpose |
| --- | --- |
| `GET /tables/:t` | fields, records, views, sections, this user's favorites, linked records |
| `POST /tables/:t/records`, `PATCH\|DELETE …/records/:id`, `POST …/records/delete` | records |
| `POST\|PATCH\|DELETE /tables/:t/fields[/:key]` | fields |
| `POST\|PATCH\|DELETE /tables/:t/views[/:id]`, `POST …/views/:id/duplicate`, `POST …/views/:id/submit` | views and form submission |
| `POST\|PATCH\|DELETE /tables/:t/sections[/:id]`, `PUT /tables/:t/layout` | sidebar sections and ordering |
| `PUT /tables/:t/favorites` | add / remove a favorite |
| `GET /tables/:t/next/:key` | the next automatic code (informational) |
| `POST /tables/:t/query` | server-side filter / search / sort / page of a table |
| `POST /files` | upload (images, PDF, text, Word, Excel; ≤ 5 MB; content is checked against its type) |

The older token-protected `/api/records/*` and `/api/airtable/*` routes (used by `scripts/import-airtable.py`)
are unchanged.

## Security notes — read before going live

- **Invite-only Supabase Auth.** Workspace pages, table reads/writes, legacy record reads, and uploaded files
  require a server-verified, confirmed email listed in `BOSS_ADMIN_EMAILS`. Current access is administrator-level;
  staff/partner roles are not implemented. User-editable metadata and the old anonymous `boss_uid` cookie are
  never authorization evidence. Auth cookies are HttpOnly, Secure in production, SameSite=Lax, and never cached.
- Browser writes require an exact `BOSS_APP_ORIGIN` match. Existing service integrations may use
  `API_WRITE_TOKEN`; treat that token as a privileged credential. Legacy mutation/import routes remain token-only.
- Invitations and recovery links open a confirmation page; a deliberate POST consumes the one-time token,
  protecting against email link scanners. Password setup requires at least 12 characters. Configure the
  invitation/recovery templates as documented in `docs/OPERATIONS.md`. Disable public signup in Supabase.
- Old anonymous favorites and personal views are preserved, but are not automatically assigned to the next
  person signing in. An administrator must review ownership before a controlled reassignment.
- Uploaded files are never served as HTML or SVG, are sent with `nosniff` and a locked-down CSP, and are
  limited to an allow-list of types.
- All record input is validated on the server (types, required, options, uniqueness, links); the browser only
  mirrors those rules for faster feedback.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection (Railway injects it) |
| `SUPABASE_URL` | Supabase Auth project URL; server-only configuration |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key, never the secret/service-role key |
| `BOSS_APP_ORIGIN` | Exact browser origin, e.g. `https://your-app.example` |
| `BOSS_ADMIN_EMAILS` | Comma-separated approved administrator emails; empty means no browser access |
| `TEST_DATABASE_URL` | Isolated localhost PostgreSQL for integration tests only |
| `API_WRITE_TOKEN` | bearer token for scripts calling `/api/records` and `/api/base` writes |
| `PGSSLMODE=require` | Legacy compatibility only: disables certificate verification; do not use in production |
| `PG_POOL_MAX` | pool size (default 10) |
| `BOSS_SERVER_QUERY_THRESHOLD` | records above which a table is filtered on the server (default 3000) |
| `BOSS_SERVER_PAGE` | records per page in that mode (default 200) |

## Migrations

`npm run db:migrate` (also run by `npm start`) applies `db/schema.sql`, seeds an **empty** database, then applies
field/view definitions and backfills. It is idempotent and non-destructive: definitions are only inserted when
missing, user edits are never overwritten, and nothing is deleted. Sample content (capabilities, inventory
details, voucher details) is added to **fresh databases only**.

## Tests

| Suite | What it covers |
| --- | --- |
| `src/lib/base/base.test.ts` | filters, sorting, grouping, search, computed fields, validation, view defaults, sidebar move / reorder logic |
| `src/server/base/api.test.ts` | real PostgreSQL: migrations, CRUD, validation, uniqueness, link integrity, permissions, layout, favorites, forms, uploads |
| `src/lib/base/features.test.ts`, `timeScale.test.ts` | sequence rules, voucher helpers, filter operators, timeline maths |
| `src/server/base/features.test.ts` | real PostgreSQL: automatic codes (incl. 12 parallel creates), Forms Style (Work / Vouchers), the fixed voucher PDF and removal of PDF generation, server filtering parity with the browser |
| original suites | AIS accounting logic, table state, record forms |
| `qa/e2e-update2.py` | browser: Create menu, automatic Code, the fixed voucher PDF (shown for every row, download, nothing generated), form categories, filtering in every view type, server-side filtering |
| `qa/base-e2e.py` | browser: navigation, all view types, create / rename / duplicate / delete, sections and drag-and-drop, favorites, inline editing, fields, forms, Team Profile, Folio, Voucher, Items, Capabilities |

See `NEEDS_CLARIFICATION.md` for assumptions and open questions.
