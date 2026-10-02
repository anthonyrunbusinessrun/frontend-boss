# BOSS Airtable — frontend

High-fidelity Next.js (App Router) + React + TypeScript implementation of the **BOSS Airtable** designs, backed by PostgreSQL.
The designs are the source of truth; anything they do not specify is listed in
[`NEEDS_CLARIFICATION.md`](./NEEDS_CLARIFICATION.md) rather than invented.

## Run

```bash
npm install
npm run dev        # http://localhost:3000  (opens on /sign-in)
npm run build && npm start
npm run lint       # tsc --noEmit
npm run db:migrate # create the PostgreSQL schema and seed an empty database
npm run db:seed    # refresh the seed records explicitly
```

To import CSV exports from Airtable without committing them to Git:

```bash
AIRTABLE_CSV_DIR=/path/to/exports \
AIRTABLE_IMPORT_URL=https://your-app.example.com \
API_WRITE_TOKEN=your-railway-secret \
python3 scripts/import-airtable.py
```

Node 20+ recommended. Next 16, React 19, TypeScript, CSS Modules (no Tailwind), `lucide-react` icons,
Inter via `@fontsource-variable/inter`. No Vite.

## Routes

| Route | Screen |
| --- | --- |
| `/sign-in`, `/sign-up` | Auth (mock) |
| `/profiles` … `/registries` | The 14 workspace tabs, one per `Screens/` image |
| `/boss` | Marked placeholder (no design supplied) |
| `/dev/cards` | Dev-only gallery of the 8 card/modal designs (404 in production) |

## Architecture

```
src/
  app/            routes: (auth) and (workspace)/[section]; server pages load data
  components/
    ui/           Button, Badge, Checkbox, Pagination, RowActions, AddRowButton, TextField
    shell/        TopHeader, TabsBar, Sidebar
    table/        DataTable (generic, grouped, themeable) + theme.ts
    view/         Workspace (sidebar + title + toolbar + table + footer), ViewToolbar
    popovers/     Popover + the eight cards (Sort, Hidden fields, Filter, Color, Share and sync, Share dialog, Group by, Profile menu)
  views/          one client component per screen: columns, theme, sidebar and toolbar config
  services/       server-side PostgreSQL data access (mock fallback without DATABASE_URL)
  data/           mock data transcribed from the screens
  types/          entity and RecordSet types
  lib/            sections, badge tones, helpers
```

**Data flow:** `[section]/page.tsx` (server) → `services/*` → PostgreSQL → `<XView data=… />` (client) → `Workspace` → `DataTable`.
View definitions contain render functions, so they live in client components; only serialisable data crosses the boundary.

The backend stores Airtable-style records in `boss_sections`, `boss_groups`, and
`boss_records`. This preserves each view's group metadata and lets the JSONB row
payload evolve without a database migration every time an Airtable field changes.
The `RecordSet<T>` return types remain the UI contract.

Complete read-only Airtable exports are mirrored separately in `airtable_tables`
and `airtable_records`. This preserves every CSV column as JSONB while keeping the
typed frontend contract stable. Source CSVs are intentionally excluded from Git.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Database health check |
| `GET /api/records/:section` | Read a complete grouped record set |
| `POST /api/records/:section` | Create a row (`groupId` + `data`) |
| `PATCH /api/records/:section/:id` | Update row fields |
| `DELETE /api/records/:section/:id` | Delete a row |
| `GET /api/airtable` | List imported Airtable tables |
| `GET /api/airtable/:table` | Read a paginated raw table mirror |
| `POST /api/airtable/:table` | Atomically replace a raw table mirror |

Mutations and all raw Airtable mirror routes require
`Authorization: Bearer $API_WRITE_TOKEN` in production.

**Design fidelity rules followed:** Flexbox/Grid layout (no absolute positioning for layout), shared tokens in
`globals.css`, per-screen table themes in each view, popovers close on Esc / outside press, controls that are not designed are inert.

## QA

`qa/` contains the Playwright scripts used to verify the build (Python, Playwright, Pillow, numpy):

```bash
BOSS_URL=http://localhost:3000 python3 qa/interact.py          # 71 interaction checks
BOSS_REF_DIR="/path/to/BOSS Airtable" python3 qa/shoot.py       # screenshot every route and diff against Screens/
BOSS_REF_DIR="/path/to/BOSS Airtable" python3 qa/audit.py 06 2  # per-column colour / position audit vs the reference
```

Visual mismatch (share of pixels differing by more than a small threshold, at 1440x900 @2x) at hand-off:
sign-in 0.9%, sign-up 1.2%, Leads 3.9%, Accounts 3.7%, Registries 3.3%, Vouchers 4.8%, Forms 4.8%, Profiles 4.9%,
Items 5.8%, Actions 6.0%, Packet 6.4%, Transactions 6.5%, Folios 6.9%, Categories 7.4%, Concepts 7.7%,
Capabilities 10.9%. Most of the remainder is text antialiasing and the clipped or placeholder artwork described in
`NEEDS_CLARIFICATION.md`; Capabilities and Concepts are the least refined screens.
