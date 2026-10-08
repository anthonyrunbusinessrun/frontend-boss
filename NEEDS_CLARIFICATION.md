# NEEDS CLARIFICATION

Everything below was either missing from the supplied designs, contradicted by them, or inferred.
None of it was invented silently: each item is also marked `NEEDS CLARIFICATION` in a code comment
next to the code it affects.

## 1. Screens and flows that were not designed

| Area | What the app does today |
| --- | --- |
| **BOSS tab** | No screen exists. `/boss` shows a marked placeholder. |
| **"Forgot Password?"** | Rendered, links to `#forgot-password`; no destination designed. |
| **Landing page after sign-in / sign-up** | Assumed `/profiles` (`DEFAULT_SECTION` in `src/lib/sections.ts`). |
| **Auth** | No backend, validation, error states or session. Submitting only navigates. There is **no auth guard** on workspace routes. |
| **Sign-in values** | The design shows the email and an 8-dot password pre-filled. These are mock `defaultValue`s. |
| **Global search** | Filters the table of the current screen. Cross-screen results (the placeholder mentions profiles, transactions and categories) are not designed. |
| **"Create new …" buttons** | Open a generated new-record drawer. The form layout is not designed: fields come from each view's `FieldDef`s. |
| **Row actions** (edit / duplicate / delete) | Work through the same drawer. Duplicate opens a pre-filled new record; delete asks for confirmation and offers Undo. Edits are kept in `localStorage`, not the database. |
| **"Add row"** | Opens the new-record drawer with the group preselected. |
| **Sidebar views other than the active one** | Only the active view of each screen is designed. Clicking another shows a toast that the saved view is not connected. Collapse and "Find a view…" filtering work. |
| **Pagination** | Real (25 rows per page). Footer counts are the actual row counts, so they no longer reproduce the design's fixed figures (e.g. Profiles reads "of 12", not "of 14"). The pagination check in `qa/interact.py` was updated to match, but Playwright was not available where this was built, so that script has not been re-run. |
| **Share dialog** (`Share "BOSS"`) | No control anywhere opens it. It exists only in the dev gallery (`/dev/cards`). Its "Share to web" tab is not designed. |
| **Share and sync actions** | "Create link", "Sync data", "Embed", "Create a form view", "Go to interfaces" and "Learn more" have no destinations. "Dismiss" works. |
| **Color card** | Only step 1 (choose "Select field" / "Conditions") is designed. |
| **Filter card** | Conditions now filter the table (operators by field type). AI prompt, "Add condition group" and "Copy from another view" are still not designed and do nothing. The design's initial Profiles conditions (Team, Inactive) are shown but have no data field to evaluate. |
| **Group card** | "Add subgroup", direction and remove-group controls are not designed. "Collapse all" / "Expand all" work on the table. |
| **Sort / Hide fields** | Sorting by a field and hiding a column work. Fields drawn in the cards that have no column or data in the view (e.g. most of the 57 hidden Profiles fields) cannot be sorted or hidden. Hiding a field adds to the "N hidden fields" count. Reordering (drag handle) is not designed. |

## 2. Contradictions and slips in the designs

- **CTA labels**: Actions says "Create new **profile**", Vouchers says "Create new **category**", and Accounts, Forms, Concepts, Capabilities, Leads and Registries say "Create new **item**". Kept as designed.
- **Tab count**: the design doc says 14 tabs; `Components/tabs-bar.png` and the screens show 15.
- **Screen count**: the doc says 14 primary views; 16 screens were supplied (two are auth).
- **Record counts**: Transactions badge says "10 Items Listed" over four rows; Concepts footer says "1–2 of 2 records" over nine rows; Categories group "2.0 INTERNAL" says 5 items over four rows; Leads group "CLIENT : FEMA" contains other clients; Hide-fields card shows all toggles on while Profiles says "57 hidden fields". Reproduced as drawn.
- **"Grouped by" labels** on Actions, Forms, Folios and Packet show no groups, or only some.
- **Accounts balance** wraps as `$152,430 / .00` in the design. That is a layout flaw and is **not** reproduced.
- **Vouchers** header text and cell text are offset by ~16px in places in the design; this is reproduced with per-column header padding.
- **Profiles toolbar**: the right-hand cluster ends 33px short of the table edge (all other screens end at the edge). Reproduced via `toolbarInsetRight`.
- **Add-row icon style** differs from the one described in the design doc; the screens were followed.

## 3. Clipped or truncated artwork

- Profiles columns after **Address**, Folios and Capabilities trailing columns, and voucher **cover images** are cut off at the frame edge. Cover images are 56×20 slivers cropped from the screen.
- Text truncated with an ellipsis in the design is **inferred** in mock data (marked in each `src/data/*.ts`): Forms (long titles, descriptions), Leads (titles), Capabilities (overview, notes, tagline), Transactions (memo, voucher detail), Items (overview).
- The **logo** is a 64px raster crop from the sign-up screen; a vector logo is needed.

## 4. Technical choices that need confirmation

- Mock data is served through `src/services`. No API contract exists; the `RecordSet<T>` types are the proposed contract.
- Fonts: Inter (variable) via `@fontsource-variable/inter`, self-hosted.
- Minimum supported width is 960px (the designs are 1440px only). No tablet or mobile layouts were designed.

## 5. Accounting Information System (AIS)

The AIS follows the layout agreed in the combined BOSS + AIS design. What the design did not settle:

| Area | What the app does today |
| --- | --- |
| **Navigation entries not built** | The AIS design also lists Estimates, Credit Notes, Expenses, Banking, Inventory, Projects and Budgeting. They were not part of the requested workflows, so no pages or placeholder routes exist. `components/ais/nav.ts` is the single place to add them. |
| **Budget tile / alert** | The design's "Budget Utilization" tile and "Marketing over budget" alert depend on Budgeting. The tile is replaced by "Avg days to collect"; the alert is not produced. |
| **Dashboard figures** | Calculated from the sample books, so they differ from the figures in the design mock. The Weekly / Quarterly / Yearly chart toggles are not implemented (the chart shows the last 6 months). |
| **Reporting date** | Fixed at 30 Sep 2026 in the sample data (Settings). "This month", aging and overdue flags use it instead of today's date. |
| **Customers / vendors and BOSS profiles** | Linked only by an optional "BOSS account owner" field holding a profile contact code (e.g. `EJH`). Nothing reads the BOSS profile data yet. |
| **Persistence** | The books are stored in the browser (`localStorage`). There is no multi-user access, audit trail or period closing; posted entries are read-only and corrected by reversal. |
| **Payments** | Recorded payments cannot be edited, only deleted and re-entered. |
| **Export** | Lists and reports export CSV. PDF / print layouts are not built. |
| **Tax, multi-currency, attachments** | Not in the design; not implemented. |
