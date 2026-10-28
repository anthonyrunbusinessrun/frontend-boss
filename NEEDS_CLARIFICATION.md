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
- *VSF* is modeled as a single select with one option (“VSF”) because the meaning is not visible. *Manifest* is long
  text (one line per shipment line); the screenshot suggests it may link to a Manifest table that does not exist here.
- The Bill of Lading preview/print uses extra fields (accrual date, consignee, ship to, deliver via, resource,
  tracking, note, terms), hidden in the “Simplified” view. The voucher number is `LLG-BL-` + (I + 4000), from
  I 11578 → LLG-BL-15578 in the screenshot. The letterhead (Land Logistics) is in
  `src/components/base/vouchers/voucherConfig.ts`.
- **QR codes** encode a link to the voucher in this app (`/vouchers?record=…`). The “Run” button generates a QR
  image for vouchers without one and stores it as an attachment.
- The previous ledger fields (Voucher ID, SP, SVC, Debit, Credit, Balance, Scans, Prefix, Label, ID, Sum, Cover)
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

**Voucher PDFs.**
- `Voucher.pdf` is an image-only Figma export with no text layer, so its fields were read from the picture.
- The L (FD) and R (BL) marks are tied to the document type because the two samples show it; confirm what they mean.
- Types: FD = Freight Delivery Confirmation (the supplied PDF), BL = Bill of Lading (the earlier sample). Existing vouchers became BL / Issued.
- Manifest and pack rows are text, one row per line, columns separated by ` | `; use `/` for a new line in a destination.
- The generated PDF follows the reference's proportions and positions but uses a free look-alike font (Saira Semi Condensed)
  and a redrawn logo. It carries a footer saying it was generated and is not an original document.
- Replacing an original leaves the old file stored in the database but unattached.
- Preview shows up to 8 pages; PDFs are limited to 5 MB.

**Forms category.** Work / Vouchers exists on form records (Forms table) and on Form *views* (builder, create dialog, sidebar tag).
Existing forms and form views were set to Work.

**Filtering.**
- Not built from the reference: “Describe how to filter this view” (an AI feature) and “Add condition group” (nested groups). Conditions are one list joined by and / or, evaluated left to right.
- In server mode (very large tables) search covers stored text, number, date, select and contact values, not linked-record names; grouping, calendar placement and timelines use the loaded page only. A filter on a field derived from another table (“folios in this category”) is refused there.
- Double-clicking a read-only cell (Code, Voucher No., PDF status…) opens the record.
