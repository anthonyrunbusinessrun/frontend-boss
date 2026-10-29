# BOSS update: what changed

## Completed
- **Navigation:** BOSS, Packet, Accounts, Registries removed (screens, seed data, images; database rows untouched). AIS removed from the
  navigation (routes remain). Remaining tabs: Profiles, Categories, Folios, Actions, Vouchers, Transactions, Items, Forms, Concepts,
  Capabilities, Leads.
- **Table engine:** typed fields, eight view types (Grid, Calendar, Gallery, Kanban, Timeline, List, Gantt, Form) sharing one set of
  records; view settings saved per view; create / rename / duplicate / delete views; Collaborative / Personal / Locked.
- **Create button:** one “Create new…” menu on every table: Grid, Calendar, Gallery, Kanban, Timeline, List, Gantt, Form, Section.
- **Sidebar:** favorites (views and records), sections, drag-and-drop to reorder and move, keyboard “Move to…”, search, persistence.
- **Header actions + modals:** contextual buttons per table opening validated create / edit forms and tools.
- **Team Profile:** Profiles section with grid, gallery directory (profile pictures) and onboarding form; Team flag; unique contact / email.
- **Categories:** Group column and input removed.  **Folios:** Cord renamed Assignee (searchable team-member link); Category is a link
  dropdown fed by Categories; unlinking on delete.
- **Vouchers:** Infant & Toddler layout (I, No, VSF, Manifest, QR), QR generator, Bill of Lading preview + print.
- **Items:** SKU, unit, category, reorder level, stock status, adjust-stock action, validation, search, low-stock view.
- **Capabilities:** System / Exception / All areas with counts, backed by an Area field.
- **Backend:** all reads and writes go through `/api/base` to PostgreSQL; server-side validation, uniqueness, link integrity, view
  permissions, uploads. Edits are no longer kept in `localStorage`.

## Database
New tables (additive): `boss_fields`, `boss_views`, `boss_nav_sections`, `boss_favorites`, `boss_files`, `boss_counters`,
`boss_migrations`. Existing tables are unchanged. One-time backfills (recorded in `boss_migrations`): profiles flagged Team / not
inactive; folios linked to profiles and categories from the old `cord` / `category` text (old text kept); voucher and item autonumbers.

## Files
- **Added:** `src/lib/base/*`, `src/server/base/*`, `src/components/base/**`, `src/app/api/base/[...path]`, `src/app/api/files/[id]`,
  `qa/base-e2e.py`, `qa/fresh-db.sh`, `qa/restart-app.sh`, `docs/CHANGES.md`.
- **Changed:** `db/schema.sql`, `scripts/migrate.ts`, `scripts/seed-data.ts`, `src/app/(workspace)/[section]/page.tsx`,
  `src/lib/sections.ts`, `src/lib/db.ts` (pool error handler), `src/components/ui/Dialog.tsx` (Escape handling), `src/app/globals.css`
  (print), `src/server/records.ts`, `src/services/index.ts`, `src/types/index.ts`, `package.json`, `README.md`, `NEEDS_CLARIFICATION.md`,
  `.gitignore`.
- **Deleted:** `src/views/*` (all legacy per-tab screens), `src/data/{packet,accounts,registries}.ts`, `public/assets/registries/*`.
- **Dependencies added:** `qrcode`, `@types/qrcode`.

## Setup
1. Set `DATABASE_URL` (and `API_WRITE_TOKEN` for scripts / production writes via token). 2. `npm install`. 3. `npm run db:migrate`
(also run by `npm start`). 4. `npm run build && npm start`. The database user needs `CREATE DATABASE` only to run the integration tests.

## Results of the checks that were run (final state)
| Command | Result |
| --- | --- |
| `npm run lint` | passes |
| `npm test` | 99 / 99 pass (33 original, 39 engine unit, 27 PostgreSQL integration) |
| `npm run build` | passes |
| `python3 qa/base-e2e.py` (browser, 67 checks, fresh database) | 67 / 67 on the last two full runs |

## Not done / to confirm
See `NEEDS_CLARIFICATION.md`. Main points: **no real authentication** (anonymous cookie user only); phone layouts not tuned;
one intermittent browser-test failure was seen once and not reproduced (likely a test timing race, tests were hardened);
drag-and-drop was exercised with Playwright's synthetic drags only; Airtable CSV import is not yet mapped onto the new fields.


# Update 2

## Completed
- **Create menu:** redesigned launcher (tiles with icon, label, short description; groups; keyboard navigation; bottom sheet on small screens). All nine options kept.
- **Automatic Code:** server-assigned sequential codes for Actions, Leads and Transactions, shown read-only in the side modal, safe under concurrency, never reused, unique index.
- **Voucher PDF:** the Vouchers screen shows the one supplied `Voucher.pdf` for every voucher (in-app pdf.js preview, open, download). No PDF is generated, uploaded or replaced. Voucher detail fields taken from the sample are kept as ordinary fields.
- **Forms Style:** the Forms table has no Category column; its **Style** column offers **Work** and **Vouchers** (default Work). “All Forms” is grouped by Style, plus “Work forms” / “Voucher forms” views. Form *views* keep a Work / Vouchers category of their own.
- **Filtering:** shared filter panel with per-type operators (between, within, any of / none of…), pills, clear all, copy from another view, reorder, empty state, persisted per view; server-side filtering and paging for large tables.

## Database
New: unique indexes `boss_seq_actions_code`, `boss_seq_leads_leadid`, `boss_seq_transactions_trans`. New fields (definitions only, no schema change): Vouchers `voucherNo`, `docType`, `docStatus`, `headline`, `vendorCode`, `vendorAccount`, `contractNo`, `operatorCode`, `operatedBy`, `deliverPhone2`, `manifestLines`, `packLines`. One-time backfills: Forms Style gets the choice Vouchers (blank styles → Work, forms marked Vouchers in the earlier Category column keep it, the Category field definition is removed and views switch to Style), vouchers → BL / Issued, voucher view columns hidden, form-category views added, PDF field definitions (`pdf`, `generatedPdf`, `pdfStatus`) removed. Existing codes and data are preserved.

## Files
- **Added:** `src/lib/base/{sequence,voucher}.ts`, `src/server/base/{recordQuery,testDb}.ts`, `src/components/base/{CreateMenu,FilterPanel}.tsx`, `src/components/base/vouchers/PdfPreview.tsx`, `public/vouchers/Voucher.pdf` (the supplied PDF), tests, `qa/e2e-update2.py`.
- **Changed:** engine types / validation / filters, definitions, migration, store and API, record drawer, grid, toolbar, sidebar, form view, voucher panel, TableApp / provider, file route (PDF headers), README, NEEDS_CLARIFICATION.
- **Removed:** the HTML Bill of Lading preview (replaced by real PDFs) and the legacy `src/views` leftovers from the previous ZIP.
- **Dependencies added:** `pdfjs-dist` (in-app PDF display).

## Setup
Same as before (`DATABASE_URL`, `npm run db:migrate`). Optional: `BOSS_SERVER_QUERY_THRESHOLD`, `BOSS_SERVER_PAGE`.

## Results of the checks that were run (final state of Update 2)
| Command | Result |
| --- | --- |
| `npm run lint` | passes |
| `npm test` | 139 / 139 pass |
| `npm run build` | passes |
| `python3 qa/base-e2e.py` (browser, fresh database) | 66 / 66 |
| `python3 qa/e2e-update2.py` (browser, fresh database, with a second server-filter instance) | 34 / 34 |

## Not done / limitations
See `NEEDS_CLARIFICATION.md` section 10: no “Describe how to filter” (AI) box or condition groups; server mode search does not cover linked-record names;
the voucher PDF is displayed with pdf.js (up to 8 pages), not the browser-native viewer; still no real authentication.

## Fix included in this version
API routes for records, fields and sections now match only their exact path. Previously a stray suffix such as `DELETE /records/:id/anything` was treated as a plain record delete.

# Update 4: dynamic voucher document

- The Vouchers side panel draws the selected voucher on the supplied template (`public/vouchers/template/Voucher_Template.png` / `.pdf`), in the sample PDFs' fonts, and redraws whenever another row is selected or a voucher is edited. Full-size view with Print.
- New: `src/lib/base/voucherDocument.ts` (what is printed, from a row), `src/data/voucherDirectory.ts` (reference text from the sample PDFs), `src/components/base/vouchers/{VoucherDocument.tsx,voucherLayout.ts}`, `qa/voucher-harness/*`, `qa/fake-auth.mjs` + `qa/start-e2e-stack.sh` (local browser tests behind the sign-in).
- Removed: the fixed `Voucher.pdf`, its pdf.js viewer and the `pdfjs-dist` dependency. Added fonts: `@fontsource/saira`, `saira-condensed`, `saira-extra-condensed`, `saira-semi-condensed`.
- Pack Details help text: five columns (the template's pack table has no Destination column).
- Fixed: the document's text-fit measurement is identical on server and first browser render (no hydration error).
- The favorites browser test now reflects the signed-in-account model of the authentication update.

# Update 5: Vouchers from the full Airtable export

- Vouchers seed data regenerated from `Vouchers-VOUCHERS - Simplified.csv` (`scripts/vouchers-csv-to-seed.py`): full multi-line Notes, "Unnamed record" manifest wording, each voucher's VSF link, Reference 2 trimmed.
- **VSF** is now a link field and **Scans** an attachment field (as in the export). Migration `v6` converts existing databases without overwriting edits (see NEEDS_CLARIFICATION section 11).
- The voucher document wraps long note lines (as the sample PDFs do).
- Not imported: the export's Scans/QR files (temporary Airtable download links).
