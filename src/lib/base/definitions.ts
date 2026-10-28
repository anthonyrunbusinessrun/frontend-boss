import { choicesFromNames } from "./fields";
import type { ChoiceColor, FieldOptions, FieldType, ViewConfig, ViewType } from "./types";
import { emptyViewConfig } from "./types";

/**
 * The tables of the BOSS workspace and their fields. Field keys are the property names that
 * already exist in `boss_records.data`, so current data is shown without any conversion.
 * Applied by `server/base/migrate.ts`: missing definitions are inserted, existing ones are never overwritten.
 */
export interface FieldSeed {
  key: string;
  name: string;
  type: FieldType;
  options?: FieldOptions;
  required?: boolean;
  primary?: boolean;
}

export interface ViewSeed {
  key: string;
  name: string;
  type: ViewType;
  /** Name of the sidebar section the view starts in. */
  section?: string;
  config?: Partial<ViewConfig>;
}

export interface TableSeed {
  slug: string;
  name: string;
  /** Singular noun for buttons and messages ("profile", "voucher"…). */
  singular: string;
  fields: FieldSeed[];
  views: ViewSeed[];
  sections?: string[];
}

const sel = (names: string[], colors?: ChoiceColor[], extra: FieldOptions = {}): FieldOptions => ({ choices: choicesFromNames(names, colors), ...extra });

const rule = (id: string, field: string, op: ViewConfig["filters"][number]["op"], value?: string | boolean): ViewConfig["filters"][number] => ({ id, join: "and", field, op, value });

export const VOUCHER_START = 11574;

/** Fields that belong to the voucher document; hidden in the compact grid views. */
export const VOUCHER_DOCUMENT_KEYS = ["headline", "docStatus", "pdf", "generatedPdf", "accrualDate", "vendorCode", "vendorAccount", "contractNo", "operatorCode", "operatedBy", "consignee", "shipTo", "deliverVia", "deliverPhone", "deliverPhone2", "resource", "tracking", "voucherNote", "terms", "manifestLines", "packLines"];
export const VOUCHER_LEGACY_KEYS = ["voucherId", "sp", "svc", "debit", "credit", "balance", "scans", "prefix", "label", "ref", "sum", "cover"];

export const TABLES: TableSeed[] = [
  /* ------------------------------------------------------------------ profiles */
  {
    slug: "profiles",
    name: "Profiles",
    singular: "profile",
    sections: ["Team Profile"],
    fields: [
      { key: "contact", name: "Contact", type: "text", required: true, options: { unique: true, placeholder: "e.g. RL3", help: "Short unique code used to refer to this person." } },
      { key: "hardCode", name: "Hard Code", type: "text" },
      { key: "smsOptIn", name: "SMS Opt In", type: "checkbox" },
      { key: "sal", name: "Sal", type: "singleSelect", options: sel(["Mr.", "Ms.", "Mrs.", "Dr."], ["gray", "gray", "gray", "gray"]) },
      { key: "name", name: "Name", type: "text", required: true, primary: true },
      { key: "position", name: "Position", type: "text", required: true },
      { key: "billing", name: "Billing", type: "singleSelect", options: sel(["LLG", "BOSS"], ["blue", "orange"]) },
      { key: "type", name: "Type", type: "singleSelect", required: true, options: sel(["Agent", "Rep"], ["green", "red"]) },
      { key: "email", name: "eMail", type: "email", required: true, options: { unique: true } },
      { key: "address", name: "Address", type: "text" },
      { key: "phone1", name: "Phone 1", type: "phone" },
      { key: "phone1Title", name: "P1 Tlt", type: "text" },
      { key: "phone2", name: "Phone 2", type: "phone" },
      { key: "phone2Title", name: "P2 Tlt", type: "text" },
      { key: "phone3", name: "Phone 3", type: "phone" },
      { key: "phone3Title", name: "P3 Tlt", type: "text" },
      { key: "team", name: "Team", type: "checkbox", options: { help: "Team members can be chosen as Assignees in Folios." } },
      { key: "inactive", name: "Inactive", type: "checkbox" },
      { key: "photo", name: "Photo", type: "attachment", options: { imagesOnly: true, help: "Profile picture (PNG, JPG, WebP; up to 5 MB)." } },
      { key: "bio", name: "Bio", type: "longText" },
    ],
    views: [
      {
        key: "active",
        name: "Active Profiles",
        type: "grid",
        config: { filters: [rule("r1", "inactive", "is", false)], hidden: ["hardCode", "phone1", "phone1Title", "phone2", "phone2Title", "phone3", "phone3Title", "bio", "photo"] },
      },
      {
        key: "team",
        name: "Team Profiles",
        type: "grid",
        section: "Team Profile",
        config: { filters: [rule("r1", "team", "is", true), rule("r2", "inactive", "is", false)], hidden: ["bio", "phone2", "phone2Title", "phone3", "phone3Title"], order: ["photo", "contact", "name", "position"] },
      },
      { key: "team-directory", name: "Team Directory", type: "gallery", section: "Team Profile", config: { coverField: "photo", titleField: "name", cardSize: "medium", filters: [rule("r1", "team", "is", true), rule("r2", "inactive", "is", false)], hidden: ["hardCode", "smsOptIn", "sal", "billing", "address", "phone1", "phone1Title", "phone2", "phone2Title", "phone3", "phone3Title", "team", "inactive", "bio", "contact"] } },
      { key: "team-onboarding", name: "New Team Onboarding Form", type: "form", section: "Team Profile" },
    ],
  },

  /* ---------------------------------------------------------------- categories */
  {
    slug: "categories",
    name: "Categories",
    singular: "category",
    fields: [
      { key: "code", name: "Value Code/Title", type: "text", required: true, primary: true, options: { unique: true } },
      { key: "levelTwo", name: "Level Two Value", type: "text" },
      { key: "folios", name: "Folios", type: "computed", options: { computed: { fn: "linkedFrom", table: "folios", key: "categoryId" } } },
    ],
    views: [{ key: "all", name: "Folio Category Value List", type: "grid", config: { sort: [{ field: "code", dir: "asc" }] } }],
  },

  /* -------------------------------------------------------------------- folios */
  {
    slug: "folios",
    name: "Folios",
    singular: "folio",
    fields: [
      { key: "folio", name: "Folio", type: "text", required: true, primary: true },
      { key: "assigneeId", name: "Assignee", type: "link", options: { linkTable: "profiles", multiple: false, legacyKey: "cord", linkFilter: { key: "team", equals: true }, help: "Team member responsible for this folio." } },
      { key: "inactive", name: "Inactive", type: "text" },
      { key: "group", name: "Group", type: "text" },
      { key: "categoryId", name: "Category", type: "link", options: { linkTable: "categories", multiple: false, legacyKey: "category" } },
      { key: "active", name: "Active", type: "number", options: { format: "integer", min: 0 } },
      { key: "asfs", name: "ASFS", type: "number", options: { format: "integer", min: 0 } },
      { key: "actions", name: "Actions", type: "text" },
    ],
    views: [
      { key: "all", name: "Folios - All Active Categories", type: "grid", config: { groupBy: [{ field: "categoryId", dir: "asc" }] } },
      { key: "by-assignee", name: "Folios by Assignee", type: "grid", config: { groupBy: [{ field: "assigneeId", dir: "asc" }], hidden: ["group", "inactive"] } },
    ],
  },

  /* ------------------------------------------------------------------- actions */
  {
    slug: "actions",
    name: "Actions",
    singular: "action",
    fields: [
      { key: "code", name: "Code", type: "text", required: true, primary: true, options: { unique: true, sequence: { prefix: "A-" }, help: "Assigned automatically: the next number after the highest existing code." } },
      { key: "accrue", name: "Accrue", type: "date", required: true },
      { key: "title", name: "Title", type: "text", required: true },
      { key: "type", name: "Type", type: "singleSelect", required: true, options: sel(["Tasking", "Training", "Notice"], ["blue", "orange", "yellow"]) },
      { key: "status", name: "Status", type: "singleSelect", required: true, options: sel(["Ongoing", "Queue", "Scheduled"], ["red", "purple", "cyan"]) },
      { key: "folio", name: "Folio", type: "text" },
      { key: "wk", name: "Wk", type: "text" },
      { key: "act", name: "Act", type: "checkbox" },
      { key: "qa", name: "QA", type: "checkbox" },
    ],
    views: [
      { key: "all", name: "All Actions", type: "grid", config: { sort: [{ field: "accrue", dir: "asc" }] } },
      { key: "calendar", name: "Action Calendar", type: "calendar", config: { dateField: "accrue", titleField: "title" } },
      { key: "board", name: "Action Board", type: "kanban", config: { stackField: "status", titleField: "title" } },
    ],
  },

  /* ------------------------------------------------------------------ vouchers */
  {
    slug: "vouchers",
    name: "Vouchers",
    singular: "voucher",
    fields: [
      { key: "i", name: "I", type: "autonumber", primary: true, options: { start: VOUCHER_START } },
      { key: "no", name: "No", type: "computed", options: { computed: { fn: "offset", source: "i", add: 1000 } } },
      { key: "vsf", name: "VSF", type: "singleSelect", options: sel(["VSF"], ["blue"]) },
      { key: "manifest", name: "Manifest", type: "longText", options: { help: "Short summary, for example “I/T-015 · GREENCASTLE · Wipes”." } },
      { key: "qr", name: "QR", type: "attachment", options: { imagesOnly: true } },
      // --- the voucher document (fields of the supplied FEMA / Infant & Toddlers PDF) ---
      { key: "voucherNo", name: "Voucher No.", type: "computed", options: { computed: { fn: "voucherNo", number: "i", type: "docType", prefix: "LLG-", offset: 4000 } } },
      { key: "docType", name: "Type", type: "singleSelect", options: { ...sel(["FD", "BL"], ["blue", "orange"]), defaultValue: "FD", help: "FD = Freight Delivery Confirmation, BL = Bill of Lading." } },
      { key: "docStatus", name: "Status", type: "singleSelect", options: { ...sel(["Issued"], ["gray"]), defaultValue: "Issued" } },
      { key: "headline", name: "Headline", type: "text", options: { placeholder: "e.g. ASN - DELIVERED", help: "Text of the dark bar at the top of the voucher." } },
      { key: "pdfStatus", name: "PDF", type: "computed", options: { computed: { fn: "fileStatus", original: "pdf", generated: "generatedPdf" } } },
      { key: "pdf", name: "Original PDF", type: "attachment", options: { pdfOnly: true, managed: "upload", help: "The uploaded original. It is never replaced or edited by the app." } },
      { key: "generatedPdf", name: "Generated PDF", type: "attachment", options: { pdfOnly: true, managed: "system", help: "Created by BOSS from the saved fields. Not an original document." } },
      { key: "accrualDate", name: "Accrual Date", type: "date" },
      { key: "vendorCode", name: "Vendor Account Code", type: "text", options: { placeholder: "e.g. FEMA-HQ" } },
      { key: "vendorAccount", name: "Vendor Account", type: "longText", options: { help: "Name and address, one line each." } },
      { key: "contractNo", name: "Contract / PO No.", type: "text", options: { placeholder: "e.g. 70FB7026F00000036" } },
      { key: "operatorCode", name: "Operated By Code", type: "text", options: { placeholder: "e.g. DC-GRC" } },
      { key: "operatedBy", name: "Operated By", type: "longText", options: { help: "Name, address and phone, one line each." } },
      { key: "consignee", name: "Consignee", type: "longText" },
      { key: "shipTo", name: "Ship To", type: "longText" },
      { key: "deliverVia", name: "Deliver Via", type: "text" },
      { key: "deliverPhone", name: "Deliver Via Phone", type: "phone" },
      { key: "deliverPhone2", name: "Deliver Via Phone 2", type: "phone" },
      { key: "resource", name: "Resource", type: "text" },
      { key: "tracking", name: "Tracking", type: "text" },
      { key: "voucherNote", name: "Voucher Note", type: "longText" },
      { key: "terms", name: "Terms of Trade", type: "longText" },
      { key: "manifestLines", name: "Manifest of Order", type: "longText", options: { help: "One row per line: CLIN | Title | Description | Delivery | Freight #" } },
      { key: "packLines", name: "Pack Details", type: "longText", options: { help: "One row per line: CLIN | Pack Size | Pallet Config | Per Kit | Qty | Destination (use / for a new line)" } },
      // Fields of the previous voucher ledger layout. Kept so existing records lose nothing.
      { key: "voucherId", name: "Voucher ID", type: "text", options: { unique: true } },
      { key: "sp", name: "SP", type: "number", options: { format: "integer", min: 0 } },
      { key: "svc", name: "SVC", type: "text" },
      { key: "debit", name: "Debit", type: "number", options: { format: "currency", min: 0 } },
      { key: "credit", name: "Credit", type: "number", options: { format: "currency", min: 0 } },
      { key: "balance", name: "Balance", type: "number", options: { format: "currency" } },
      { key: "scans", name: "Scans", type: "number", options: { format: "integer", min: 0 } },
      { key: "prefix", name: "Prefix", type: "text" },
      { key: "label", name: "Label", type: "text" },
      { key: "ref", name: "ID", type: "text" },
      { key: "sum", name: "Sum", type: "number", options: { format: "currency" } },
      { key: "cover", name: "Cover", type: "attachment", options: { imagesOnly: true } },
    ],
    views: [
      {
        key: "simplified",
        name: "VOUCHERS | Simplified",
        type: "grid",
        config: {
          sort: [{ field: "i", dir: "asc" }],
          hidden: [...VOUCHER_DOCUMENT_KEYS, ...VOUCHER_LEGACY_KEYS],
          order: ["i", "no", "vsf", "manifest", "qr", "voucherNo", "docType", "pdfStatus"],
          widths: { i: 90, no: 100, vsf: 90, manifest: 240, qr: 120, voucherNo: 140, docType: 70, pdfStatus: 140 },
        },
      },
      { key: "document", name: "Voucher Details", type: "grid", config: { sort: [{ field: "i", dir: "asc" }], hidden: [...VOUCHER_LEGACY_KEYS, "no", "vsf", "manifest", "qr", "consignee", "shipTo"] } },
      { key: "ledger", name: "Ledger (previous layout)", type: "grid", config: { hidden: ["manifest", "qr", ...VOUCHER_DOCUMENT_KEYS] } },
    ],
  },

  /* -------------------------------------------------------------- transactions */
  {
    slug: "transactions",
    name: "Transactions",
    singular: "transaction",
    fields: [
      { key: "trans", name: "Trans", type: "text", required: true, primary: true, options: { unique: true, sequence: { prefix: "", pad: 5 }, help: "Assigned automatically." } },
      { key: "voucher", name: "Voucher", type: "text", required: true },
      { key: "custRef", name: "Cust Ref", type: "text" },
      { key: "accrue", name: "Accrue", type: "date" },
      { key: "acct", name: "Acct", type: "singleSelect", options: sel(["COGS", "SALES"], ["purple", "green"]) },
      { key: "item", name: "Item", type: "text" },
      { key: "memo", name: "Memo", type: "text" },
      { key: "drQty", name: "Dr Qty", type: "number", options: { format: "decimal" } },
      { key: "crQty", name: "Cr Qty", type: "number", options: { format: "decimal" } },
      { key: "qty", name: "Qty", type: "number", options: { format: "decimal" } },
      { key: "direct", name: "Direct", type: "singleSelect", options: sel(["Yes", "No"], ["green", "gray"]) },
      { key: "detail", name: "Detail", type: "longText" },
    ],
    views: [{ key: "all", name: "All Transactions", type: "grid", config: { groupBy: [{ field: "voucher", dir: "asc" }] } }],
  },

  /* --------------------------------------------------------------------- items */
  {
    slug: "items",
    name: "Items",
    singular: "item",
    fields: [
      { key: "n", name: "N.", type: "autonumber", options: { start: 1 } },
      { key: "pic", name: "Pic", type: "attachment", options: { imagesOnly: true } },
      { key: "title", name: "Title", type: "text", required: true, primary: true },
      { key: "sku", name: "SKU", type: "text", options: { unique: true, placeholder: "e.g. BF-0001", help: "Stock keeping unit. Must be unique." } },
      { key: "overview", name: "Description", type: "longText" },
      { key: "category", name: "Category", type: "singleSelect", options: sel(["Feeding", "Diapering", "Comfort", "Hygiene"], ["green", "blue", "purple", "cyan"]) },
      { key: "purstat", name: "Purstat", type: "singleSelect", required: true, options: sel(["Purchased"], ["green"]) },
      { key: "location", name: "Location", type: "text" },
      { key: "qty", name: "Qty", type: "number", required: true, options: { format: "integer", min: 0 } },
      { key: "unit", name: "Unit", type: "singleSelect", options: sel(["each", "box", "case", "pack", "bottle"], ["gray", "gray", "gray", "gray", "gray"]) },
      { key: "reorderLevel", name: "Reorder level", type: "number", options: { format: "integer", min: 0, help: "Stock at or below this quantity shows as Low stock." } },
      { key: "stockStatus", name: "Stock status", type: "computed", options: { computed: { fn: "stockStatus", qty: "qty", reorder: "reorderLevel" } } },
      { key: "kit", name: "Kit", type: "singleSelect", required: true, options: sel(["Kit Alpha", "Kit Beta", "Kit Gamma", "Kit Delta"], ["blue", "cyan", "purple", "pink"]) },
      { key: "assigned", name: "Assigned", type: "text" },
    ],
    views: [
      { key: "all", name: "All Items", type: "grid", config: { sort: [{ field: "n", dir: "asc" }] } },
      { key: "low-stock", name: "Low and out of stock", type: "grid", config: { filters: [rule("r1", "stockStatus", "isNot", "In stock")], sort: [{ field: "qty", dir: "asc" }] } },
      { key: "gallery", name: "Inventory Gallery", type: "gallery", config: { coverField: "pic", titleField: "title", cardSize: "medium", hidden: ["n", "overview", "purstat", "assigned", "kit", "location", "unit", "reorderLevel", "category"] } },
    ],
  },

  /* ------------------------------------------------------------------- forms */
  {
    slug: "forms",
    name: "Forms",
    singular: "form",
    fields: [
      { key: "code", name: "Code", type: "text", required: true, primary: true, options: { unique: true } },
      { key: "type", name: "Type", type: "text" },
      { key: "slug", name: "Slug", type: "text", required: true },
      { key: "style", name: "Style", type: "singleSelect", options: sel(["Work"], ["green"]) },
      { key: "category", name: "Category", type: "singleSelect", required: true, options: { ...sel(["Work", "Vouchers"], ["green", "orange"]), defaultValue: "Work", help: "What the form is for. This is not the view type." } },
      { key: "title", name: "Title", type: "text", required: true },
      { key: "longTitle", name: "Long Title", type: "text" },
      { key: "group", name: "Group", type: "singleSelect", options: sel(["Buy", "Blanket"], ["green", "cyan"]) },
      { key: "description", name: "Description", type: "longText" },
    ],
    views: [
      { key: "all", name: "All Forms", type: "grid", config: { groupBy: [{ field: "category", dir: "asc" }] } },
      { key: "work", name: "Work forms", type: "grid", config: { filters: [rule("r1", "category", "is", "Work")] } },
      { key: "vouchers", name: "Voucher forms", type: "grid", config: { filters: [rule("r1", "category", "is", "Vouchers")] } },
    ],
  },

  /* ----------------------------------------------------------------- concepts */
  {
    slug: "concepts",
    name: "Concepts",
    singular: "concept",
    fields: [
      { key: "title", name: "Title", type: "text", required: true, primary: true },
      { key: "release", name: "Release", type: "text" },
      { key: "acronym", name: "Acronym", type: "text" },
      { key: "type", name: "Type", type: "singleSelect", options: sel(["Course"], ["green"]) },
      { key: "definition", name: "Definition", type: "longText" },
      { key: "related", name: "Related", type: "text" },
      { key: "link", name: "Link", type: "text" },
      { key: "work", name: "Work", type: "multiSelect", options: { choices: [], allowOther: true } },
    ],
    views: [{ key: "all", name: "All Concepts", type: "grid" }],
  },

  /* ------------------------------------------------------------- capabilities */
  {
    slug: "capabilities",
    name: "Capabilities",
    singular: "capability",
    fields: [
      { key: "code", name: "Code", type: "text", required: true, options: { unique: true } },
      { key: "competency", name: "Competency", type: "singleSelect", options: sel(["Business Systems", "Transportation & Logistics", "Program Management & Contact Center"], ["blue", "orange", "purple"]) },
      { key: "area", name: "Area", type: "singleSelect", options: { ...sel(["System", "Exception"], ["cyan", "red"]), help: "System and Exception capabilities appear in their own areas; All shows every capability." } },
      { key: "sort", name: "Sort", type: "number", options: { format: "integer" } },
      { key: "go", name: "GO", type: "checkbox", options: { icon: "flag" } },
      { key: "title", name: "Title", type: "text", required: true, primary: true },
      { key: "overview", name: "Brief Overview", type: "longText" },
      { key: "gallery", name: "Gallery", type: "attachment", options: { imagesOnly: true } },
      { key: "notes", name: "Notes", type: "longText" },
      { key: "attachment", name: "Attachments", type: "text" },
      { key: "features", name: "Key Features", type: "multiSelect", options: { choices: [], allowOther: true } },
      { key: "tagline", name: "Tagline", type: "text" },
    ],
    views: [
      { key: "live", name: "LIVE", type: "grid", config: { filters: [rule("r1", "go", "is", true)], hidden: ["competency", "area", "sort", "notes", "attachment", "features", "tagline"] } },
      { key: "all", name: "All", type: "grid", config: { groupBy: [{ field: "go", dir: "asc" }], sort: [{ field: "sort", dir: "asc" }], hidden: ["overview", "gallery", "notes", "attachment", "features"] } },
      { key: "exceptions", name: "EXCEPTIONS", type: "grid", config: { filters: [rule("r1", "area", "is", "Exception")], hidden: ["competency", "area", "sort", "notes", "attachment", "features", "tagline"] } },
      { key: "gallery", name: "Gallery", type: "gallery", config: { coverField: "gallery", titleField: "title", cardSize: "large", hidden: ["code", "competency", "area", "sort", "go", "notes", "attachment", "features", "tagline"] } },
      { key: "system", name: "SYSTEM", type: "grid", config: { filters: [rule("r1", "area", "is", "System")], hidden: ["competency", "area", "sort", "notes", "attachment", "features", "tagline"] } },
    ],
  },

  /* -------------------------------------------------------------------- leads */
  {
    slug: "leads",
    name: "Leads",
    singular: "lead",
    fields: [
      { key: "leadId", name: "Lead ID", type: "text", required: true, primary: true, options: { unique: true, sequence: { prefix: "L-" }, help: "Assigned automatically." } },
      { key: "client", name: "Client", type: "text", required: true },
      { key: "title", name: "Title", type: "text", required: true },
      { key: "type", name: "Type", type: "singleSelect", options: sel(["Solicitation", "Sources Sought", "Combined Syn/Solicitation", "Request for Information"], ["blue", "orange", "purple", "cyan"]) },
      { key: "due", name: "Due", type: "text", options: { placeholder: "MM/DD/YYYY" } },
      { key: "hasFiles", name: "Files", type: "checkbox" },
      { key: "url", name: "URL", type: "url" },
    ],
    views: [{ key: "all", name: "All Leads", type: "grid", config: { groupBy: [{ field: "client", dir: "asc" }] } }],
  },
];

export const TABLE_SLUGS = TABLES.map((t) => t.slug);
export const tableSeed = (slug: string) => TABLES.find((t) => t.slug === slug);

export function seedViewConfig(seed: ViewSeed): ViewConfig {
  return { ...emptyViewConfig(), ...seed.config, key: seed.key };
}
