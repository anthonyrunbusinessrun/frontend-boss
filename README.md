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
npm test                            # unit tests, plus PostgreSQL integration tests when DATABASE_URL is set
```

`DATABASE_URL` is **required**: every table screen reads and writes PostgreSQL. Node 20+.
The integration tests create and drop their own throwaway database, so the URL needs `CREATE DATABASE` rights.

Browser end-to-end checks (Playwright for Python, Chromium):

```bash
DATABASE_URL=postgresql://… sh qa/fresh-db.sh     # DROPS and recreates the database: test databases only
sh qa/restart-app.sh                              # starts the production build on :3100
BOSS_URL=http://localhost:3100 python3 qa/base-e2e.py          # tables, views, sidebar, records, sections
# optional second instance to test server-side filtering with a tiny page size:
BOSS_SERVER_QUERY_THRESHOLD=5 BOSS_SERVER_PAGE=6 npx next start -p 3101 &
BOSS_URL=http://localhost:3100 BOSS_URL_SERVER=http://localhost:3101 python3 qa/e2e-update2.py   # create menu, codes, PDFs, form categories, filters
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

Text fields can be marked `sequence` (see `definitions.ts`): Actions **Code** (`A-4702`), Leads **Lead ID** (`L-4097`) and
Transactions **Trans** (`04105`). The server assigns the next code when a record is created: one more than the highest
number in use (never the record count), remembered in `boss_counters` so a deleted record's code is not reused, inside
the table's write lock so simultaneous creates get different numbers, and backed by a unique index
(`boss_seq_<table>_<field>`). The side modal shows the next code immediately (`GET /tables/:t/next/:key`); it is not
reserved. A code sent by a client is ignored and an existing code cannot be changed.

### Voucher PDFs

A voucher has an **Original PDF** and a **Generated PDF**, stored in two separate fields (`pdf`, `generatedPdf`).

- The original is the uploaded file, byte for byte. It can be attached when the voucher is created or with
  `POST /tables/vouchers/records/:id/files/pdf`; replacing an existing one needs `replace=true` (the UI asks first).
  Editing voucher details never changes it, and the record form cannot edit it.
- **Generate PDF** builds a PDF from the saved fields (`src/server/base/voucherPdf.ts`, laid out like the supplied sample) and
  labels it as generated. It never replaces or hides the original. Long manifests continue on extra pages.
- Both open in an in-app preview (pdf.js) and download unchanged (`/api/files/:id?download=1`).
- Voucher number: `LLG-` + type (`FD` or `BL`) + (I + 4000). Manifest and pack rows are written one per line with ` | ` between columns.

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
| `POST /tables/vouchers/records/:id/files/pdf`, `…/generate-pdf`, `DELETE …/generated-pdf` | original upload (`replace=true` to replace), PDF generation |
| `POST /files` | upload (images, PDF, text, Word, Excel; ≤ 5 MB; content is checked against its type) |

The older token-protected `/api/records/*` and `/api/airtable/*` routes (used by `scripts/import-airtable.py`)
are unchanged.

## Security notes — read before going live

- **There is no real authentication.** Sign-in and sign-up remain the original mock screens. For favorites and
  personal views the browser receives an anonymous id in an httpOnly cookie. Writes also require a same-origin
  request, which stops cross-site requests but **does not stop anyone who can reach the site**. Put real
  authentication in front of the app (or replace `userId` in `src/server/base/api.ts` with your session user)
  before exposing it.
- Uploaded files are never served as HTML or SVG, are sent with `nosniff` and a locked-down CSP, and are
  limited to an allow-list of types.
- All record input is validated on the server (types, required, options, uniqueness, links); the browser only
  mirrors those rules for faster feedback.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection (Railway injects it) |
| `API_WRITE_TOKEN` | bearer token for scripts calling `/api/records` and `/api/base` writes |
| `PGSSLMODE=require` | for providers whose public endpoint needs TLS |
| `PG_POOL_MAX` | pool size (default 10) |
| `BOSS_PUBLIC_URL` | public address of the app, used in generated documents (the QR code links back to the voucher). Defaults to the request's address |
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
| `src/lib/base/features.test.ts`, `timeScale.test.ts` | sequence rules, managed (PDF) fields, voucher helpers, filter operators, timeline maths |
| `src/server/base/features.test.ts` | real PostgreSQL: automatic codes (incl. 12 parallel creates), form categories, voucher PDF upload / generate / replace rules, server filtering parity with the browser |
| original suites | AIS accounting logic, table state, record forms |
| `qa/e2e-update2.py` | browser: Create menu, automatic Code, voucher PDFs (preview, upload, replace, generate, download), form categories, filtering in every view type, server-side filtering |
| `qa/base-e2e.py` | browser: navigation, all view types, create / rename / duplicate / delete, sections and drag-and-drop, favorites, inline editing, fields, forms, Team Profile, Folio, Voucher, Items, Capabilities |

See `NEEDS_CLARIFICATION.md` for assumptions and open questions.
