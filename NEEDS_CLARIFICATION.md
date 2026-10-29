# Assumptions and open questions

Everything here was either not determinable from the Airtable screenshots / existing code, or is a choice
that should be confirmed. Nothing is hidden: each item says what the app does today.

## 1. Security and users (most important)

| Topic | What the app does today |
| --- | --- |
| **Authentication** | None. Sign-in / sign-up are the original mock screens and no route is guarded. |
| **Who is “the user”?** | An anonymous id in an httpOnly cookie (one per browser). Favorites and personal views belong to it. Clearing cookies, or using another browser, is a different user. |
| **Write protection** | Same-origin check only. Anyone who can reach the site can read and change data. Add real auth before going live. |
| **Permissions** | Collaborative / Personal / Locked views are enforced on the server against that cookie id. There are no roles (admin / editor / viewer). |

## 2. Views, sections and sidebar

- **“Section” and “folder” are one thing.** The Create menu's *Section* and the folders in the sidebar organization
  requirements are the same entity. Sections do not nest.
- Deleting a section moves its views back to the sidebar; no view or record is deleted.
- A table must keep at least one view (the last one cannot be deleted).
- “Collaborative / Personal / Locked” follows the Airtable dialog in your screenshot. A locked view can be
  unlocked only by its owner (any user, for the seeded views, which have no owner).
- Section collapsed / expanded state is remembered per browser, not per account.
- Gantt dependencies are a *link to the same table* field. The view offers to create one; there is no
  built-in “predecessor” type.
- Timeline / Gantt bars can be dragged to move them, or by the right edge to change the end date.
- Calendar shows one month at a time (no week or day layout). Records without a date are listed as “no date”.
- All filtering, sorting and grouping happens in the browser over the table's records. That is fine for
  thousands of rows; very large tables would need server-side queries.
- A view setting changed and then followed by a refresh within ~250 ms can be lost (it is saved after a short delay).

## 3. Team Profile

- The existing Profiles table is treated as the team directory: the one-time migration marked every existing profile
  as `Team = checked` and `Inactive = unchecked`. Un-check Team for vendors / clients that should not be assignable.
- Fields were taken from the visible columns of the Airtable “Team Profiles” view (Contact, Hard Code, SMS Opt In,
  Sal, Name, Position, Billing, Type, eMail, Address, Phone 1–3 and titles, Team, Inactive) plus **Photo** and **Bio**.
  The 57 hidden Airtable fields were not visible, so they are not modeled.
- Contact code and eMail must be unique (case-insensitive).
- The Airtable sidebar's other profile views (Company, Client, Vendor, Fleet, Team Bios, Text Blast…) were not
  recreated: nothing in the data says how they are filtered. Create them with Filter + Create new…

## 4. Categories and Folios

- The **Group** field is removed from Categories (column and input). Stored `group` values stay in the records.
- Folio **Cord → Assignee**: existing values were matched to profiles by contact code (e.g. `EJE`). A value without a
  unique match keeps its text and is shown muted until someone links it. The migration prints how many.
- Folio **Category** was matched to category records by title the same way.
- Folio also has its own **Group** text field (unchanged: only Categories lost Group).
- Categories' **Folios** column is now a read-only list of the folios that point at the category.

## 5. Vouchers (from the Infant & Toddler screenshot)

- Columns follow the screenshot: **I** (autonumber, starts at 11574), **No** (= I + 1000), **VSF**, **Manifest**, **QR**.
- **VSF** is a link field: the export holds each voucher's record link (an Airtable URL such as `https://airtable.com/tbl…/rec…`). It opens in a new tab and must be a real link. (Earlier it was a one-option dropdown.) *Manifest* is long text, one shipment line per line.
- **Scans** is an attachment field, as in the export. The export's one scan (`2026-0709-01_DC_PA.pdf` on voucher 15574) and its QR image files are referenced only by temporary Airtable download links, which are not read or stored: upload the scan in the app, and use the QR generator for the QR column.
- Extra fields hold the details printed on a voucher (accrual date, vendor account, operated by, deliver via, resource,
  tracking, note, terms, manifest rows), hidden in the “Simplified” view. The voucher number is `LLG-` + type + (I + 4000):
  I 11574 with type FD gives `LLG-FD-15574`, as on the supplied PDF. The earlier HTML “Bill of Lading” preview was replaced
  by the voucher document drawn on the supplied template (see section 10).
- **QR codes** encode a link to the voucher in this app (`/vouchers?record=…`). The “Run” button generates a QR
  image for vouchers without one and stores it as an attachment.
- The previous ledger fields (Voucher ID, SP, SVC, Debit, Credit, Balance, Prefix, Label, Legacy ID, Sum, Cover)
  are kept, hidden, and visible in the “Ledger (previous layout)” view. No accounting rules are applied to them.
- The screenshot's “Extensions” panel is a Voucher tools panel here; the “Edit code” part is not reproduced.

## 6. Items (inventory)

- Added: SKU (unique), Category (single select, editable), Unit (single select), Reorder level, and a computed
  **Stock status**: *Out of stock* at 0, *Low stock* at or below the reorder level, otherwise *In stock*.
- The *Category* options (Feeding, Diapering, Comfort, Hygiene) and Unit options are starting values: edit them in the
  field settings. Items do **not** use the Folio Categories table because those are filing categories.
- “Adjust stock” changes the quantity (add / remove / set) and cannot go below zero. There is no movement history.

## 7. Capabilities

- The three areas are filters on a new single-select field **Area** (*System* / *Exception*); **All** shows
  everything. System and Exception were not defined anywhere in the data, so they are whatever you set Area to.
- On a fresh database the five System and four Exception capabilities are transcribed from your screenshots.
  An existing database is **not** given Area values: set them in the grid.
- LIVE = GO checked, as the name suggests; confirm.

## 8. Data and migration

- No record is deleted by any migration. Legacy properties are never removed.
- Packet, Accounts and Registries rows stay in the database; their API entries and screens are gone.
- Attachments are stored in PostgreSQL (≤ 5 MB each). For many large files, move them to object storage.
- “Delete field” removes the field from every view and form but keeps the stored values in the records.
- Imports: `scripts/import-airtable.py` still mirrors Airtable CSVs into `airtable_tables` (read-only). It does not
  yet map them onto the new fields.

## 9. UI

- The look stays BOSS dark navy/red. The Airtable screenshots were used for structure and behavior only.
- Layout is designed for desktop and tablet widths. Phone layouts are usable but not tuned; the app frame
  still has a 960 px minimum width on most screens.
- The legacy design-fidelity scripts and the AIS module are not part of the new navigation.

## 10. Second round of updates

**Create menu.** Same nine options and behaviour; new original design (tile launcher). Shown as a bottom sheet below 640 px.

**Automatic codes.**
- Only Actions (`A-`), Leads (`L-`) and Transactions (5 digits) have sequences. Forms codes (`JC`, `WT`…) are mnemonics, so they stay typed.
- A code must follow the pattern to count: a legacy code in another format does not move the sequence.
- The number shown in the side modal is a preview. If someone else saves first, the server assigns the next number and the toast says so.
- Existing codes are untouched. The unique index is created by the migration; if an existing database already has duplicate
  codes the migration prints a warning and skips the index (the server still blocks new duplicates).

**Voucher document (template + the row's fields).**
- The default template is `Voucher_Template.png` / `.pdf` exactly as supplied. Its placeholders (the Invoice 15597 example) are covered and redrawn with the selected voucher's text. The manifest table header is redrawn with a wider Title column, because the samples need long titles on one line.
- The sample PDFs were used for wording, fonts and sizes. The template is the same design with different page margins and glyph proportions, so the template's own geometry is used.
- Reference text that is not a table column comes from the sample PDFs: party names and addresses for the codes FEMA-HQ, LLG, QUOTE, DC-GRC, DC-ATL, DC-TRC, DC-PRC; carriers SAIA and TQL (the second phone number is printed on FD and FT only, as in the samples); the top title, party labels and terms of each Form. DC-FTW has no sample, so only its code prints. Unknown codes print the code only.
- The L / R mark: FD, FT and FQ show "L"; BL and IN show "R" (what the samples show; what the letters mean is not stated).
- The Manifest column fills the Title column (one row per line); CLIN is taken from a leading `I/T-nnn`. Description, Delivery, Freight #, and the pack table (CLIN, Pack Size, Pallet Config, Per Kit, Qty) stay empty unless the voucher's optional Manifest of Order / Pack Details columns are filled in (`CLIN | Title | Description | Delivery | Freight #` per line).
- Notes: a line like `Label: value` prints the label in bold; any other line prints in bold. The sheet's Notes mostly hold one line, while the sample PDFs show longer notes.
- Nothing is generated or stored: the document is drawn in the browser. Printing uses the browser's print dialog.

**Forms table: Style (Work / Vouchers).** The Forms table has no Category column. Its **Style** column is a dropdown with two choices,
**Work** and **Vouchers** (new forms default to Work), chosen when creating or editing a form (drawer or grid cell). "All Forms" is grouped by Style
and there are “Work forms” and “Voucher forms” views. Existing forms were all Work and stay Work; a form that had been marked Vouchers in the earlier
Category column keeps it as its Style (the old value stays in the record, it is only no longer shown). The separate **Form view** (the view type)
still has its own Work / Vouchers category in its builder and create dialog and a tag in the sidebar; say if you want that removed too.

**Filtering.**
- Not built from the reference: “Describe how to filter this view” (an AI feature) and “Add condition group” (nested groups). Conditions are one list joined by and / or, evaluated left to right.
- In server mode (very large tables) search covers stored text, number, date, select and contact values, not linked-record names; grouping, calendar placement and timelines use the loaded page only. A filter on a field derived from another table (“folios in this category”) is refused there.
- Double-clicking a read-only cell (Code, Voucher No., PDF status…) opens the record.

## 11. Vouchers from the full Airtable export (Vouchers-VOUCHERS - Simplified.csv)

- The export has the same 20 columns and 16 vouchers as before. What it adds: the **full Notes** (several lines per voucher), the Manifest wording "Unnamed record" (was "Unnamed manifest"), and each voucher's **VSF** link. Reference 2 had a trailing space on some rows; it is trimmed.
- The export's Manifest cell is a comma-joined list in which items containing a comma are quoted; the data is stored one line per row (`scripts/vouchers-csv-to-seed.py` does the conversion and can be run again on a newer export).
- Existing databases: `npm run db:migrate` completes only what is still the old seed value (a note cut to its first line, "Unnamed manifest", the placeholder VSF). A note, link or manifest a person edited is kept. An old numeric Scans value is kept in the record as `scansCount`. A voucher that was deleted is not brought back.
- The voucher document now prints the full Notes (bold labels) and wraps long note lines as the sample PDFs do.
