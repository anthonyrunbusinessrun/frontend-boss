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
| **Global search** | Field is presentational; results are not designed. |
| **"Create new …" buttons** | Rendered with the designed label; no creation flow is designed (inert). |
| **Row actions** (edit / duplicate / delete) | Icons rendered; no form, duplicate result or delete confirmation is designed (inert). |
| **"Add row"** | Rendered; row-creation UI not designed (inert). |
| **Sidebar views other than the active one** | Only the active view of each screen is designed. Other entries are presentational. Collapse and "Find a view…" filtering do work. |
| **Pagination page 2** | Page state changes, but page 2 content is not designed so the table does not change. |
| **Share dialog** (`Share "BOSS"`) | No control anywhere opens it. It exists only in the dev gallery (`/dev/cards`). Its "Share to web" tab is not designed. |
| **Share and sync actions** | "Create link", "Sync data", "Embed", "Create a form view", "Go to interfaces" and "Learn more" have no destinations. "Dismiss" works. |
| **Color card** | Only step 1 (choose "Select field" / "Conditions") is designed. |
| **Filter card** | AI prompt, "Add condition group", "Copy from another view" and the join/field lists beyond the checkbox fields are not designed. Add/delete/toggle conditions work locally and do not filter the table. |
| **Group card** | "Add subgroup", direction and remove-group controls are not designed. "Collapse all" / "Expand all" work on the table. |
| **Sort / Hide fields** | Field lists scroll beyond the visible rows in the design. Hide-field toggles work locally but do not change table columns or the "57 hidden fields" label. Reordering (drag handle) is not designed. |

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
