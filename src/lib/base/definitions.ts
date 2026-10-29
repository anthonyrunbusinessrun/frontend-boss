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

/** Values used in the Actions export. The first three of each were the original choices and keep their place. */
export const ACTION_STATUSES = ["Ongoing", "Queue", "Scheduled", "Priority", "Review", "NOW", "Snoozed", "Problem", "Waiting For", "Archive"];
export const ACTION_STATUS_COLORS: ChoiceColor[] = ["red", "purple", "cyan", "orange", "blue", "green", "gray", "pink", "yellow", "gray"];
export const ACTION_TYPES = ["Tasking", "Training", "Notice", "Research", "Planning", "Phone", "Movement", "Outcome", "Sourcing", "Legal", "Updates", "Decision", "Cancel", "Maintenance", "Conf Call", "Mech", "Banking", "Meeting"];
export const ACTION_TYPE_COLORS: ChoiceColor[] = ["blue", "orange", "yellow", "purple", "cyan", "green", "pink", "green", "cyan", "red", "blue", "orange", "gray", "yellow", "purple", "gray", "green", "pink"];
/** Fields of the earlier Actions table that are not in the export. A database that has them keeps the values, hidden. */
export const ACTION_PREVIOUS_KEYS = ["act"];

/** FEMA_Vouchers.xlsx column order (Voucher … Notes). */
export const VOUCHER_FEMA_ORDER = [
  "voucherNo",
  "accrualDate",
  "docType",
  "headline",
  "docStatus",
  "by",
  "vendorCode",
  "contractNo",
  "operatorCode",
  "reference2",
  "deliverVia",
  "resource",
  "tracking",
  "scans",
  "i",
  "no",
  "vsf",
  "manifest",
  "qr",
  "voucherNote",
] as const;

/** Printed-document extras kept off the FEMA grid (and the ledger view). */
export const VOUCHER_DOCUMENT_KEYS = ["vendorAccount", "operatedBy", "consignee", "shipTo", "deliverPhone", "deliverPhone2", "terms", "manifestLines", "packLines"];
export const VOUCHER_LEGACY_KEYS = ["voucherId", "sp", "svc", "debit", "credit", "balance", "prefix", "label", "ref", "sum", "cover"];

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
      // Columns of the Actions export, in its order (Code, Wk, Accrue, Status, Task Title, Type, Folio, Asn, QA, Sort).
      { key: "code", name: "Code", type: "text", required: true, primary: true, options: { unique: true, sequence: { prefix: "A-" }, help: "Assigned automatically: the next number after the highest existing code." } },
      { key: "wk", name: "Wk", type: "text", options: { placeholder: "e.g. 26.28", help: "Week of the action, or “Action” when it has no date." } },
      { key: "accrue", name: "Accrue", type: "date" },
      { key: "status", name: "Status", type: "singleSelect", options: sel(ACTION_STATUSES, ACTION_STATUS_COLORS) },
      { key: "title", name: "Task Title", type: "text" },
      { key: "type", name: "Type", type: "singleSelect", options: sel(ACTION_TYPES, ACTION_TYPE_COLORS) },
      { key: "folio", name: "Folio", type: "text" },
      { key: "asn", name: "Asn", type: "link", options: { linkTable: "profiles", multiple: true, legacyKey: "asnCode", linkFilter: { key: "team", equals: true }, help: "Team members the action is assigned to." } },
      { key: "qa", name: "QA", type: "checkbox" },
      { key: "sort", name: "Sort", type: "number", options: { format: "integer", min: 0 } },
    ],
    views: [
      // The export lists the actions in this order (grouped by assignee), so the main view keeps the table's own order.
      { key: "all", name: "All Actions", type: "grid", config: { widths: { code: 100, wk: 90, accrue: 110, status: 110, title: 360, type: 110, folio: 240, asn: 140, qa: 60, sort: 70 } } },
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
      // FEMA_Vouchers.xlsx headers (field keys map to existing record properties where possible).
      { key: "voucherNo", name: "Voucher", type: "computed", options: { computed: { fn: "voucherNo", number: "i", type: "docType", prefix: "LLG-", offset: 4000 } } },
      { key: "accrualDate", name: "Accrue", type: "date" },
      { key: "docType", name: "Form", type: "singleSelect", options: { ...sel(["FD", "FT", "BL", "FQ", "IN"], ["blue", "cyan", "orange", "yellow", "purple"]), defaultValue: "FD", help: "FD = Freight Delivery, FT = In Transit ASN, BL = Bill of Lading, FQ = Freight RFQ, IN = Invoice." } },
      { key: "headline", name: "Form Title", type: "text", options: { placeholder: "e.g. ASN - DELIVERED", help: "Text of the dark bar at the top of the voucher." } },
      { key: "docStatus", name: "Status", type: "singleSelect", options: { ...sel(["Issued", "Planned", "BOOKED"], ["gray", "yellow", "green"]), defaultValue: "Issued" } },
      { key: "by", name: "By", type: "text", options: { placeholder: "e.g. RL3", help: "Operator contact code (matches Profiles Contact)." } },
      { key: "vendorCode", name: "Issued", type: "text", options: { placeholder: "e.g. FEMA-HQ" } },
      { key: "contractNo", name: "Reference 1", type: "text", options: { placeholder: "e.g. 70FB7026F00000036" } },
      { key: "operatorCode", name: "Perform", type: "text", options: { placeholder: "e.g. DC-GRC" } },
      { key: "reference2", name: "Reference 2", type: "text" },
      { key: "deliverVia", name: "Via", type: "text", options: { placeholder: "e.g. SAIA" } },
      { key: "resource", name: "Resource", type: "text" },
      { key: "tracking", name: "Tracking #", type: "text" },
      { key: "scans", name: "Scans", type: "attachment", options: { help: "Scanned documents for this voucher." } },
      { key: "i", name: "ID", type: "autonumber", primary: true, options: { start: VOUCHER_START } },
      { key: "no", name: "No", type: "computed", options: { computed: { fn: "offset", source: "i", add: 1000 } } },
      { key: "vsf", name: "VSF", type: "url", options: { placeholder: "https://…", help: "Link to the voucher's record." } },
      { key: "manifest", name: "Manifest", type: "longText", options: { help: "Shipment lines, one per line." } },
      { key: "qr", name: "QR", type: "attachment", options: { imagesOnly: true } },
      { key: "voucherNote", name: "Notes", type: "longText" },
      // Extra printed-document details (hidden on the FEMA grid).
      { key: "vendorAccount", name: "Vendor Account", type: "longText", options: { help: "Name and address, one line each." } },
      { key: "operatedBy", name: "Operated By", type: "longText", options: { help: "Name, address and phone, one line each." } },
      { key: "consignee", name: "Consignee", type: "longText" },
      { key: "shipTo", name: "Ship To", type: "longText" },
      { key: "deliverPhone", name: "Deliver Via Phone", type: "phone" },
      { key: "deliverPhone2", name: "Deliver Via Phone 2", type: "phone" },
      { key: "terms", name: "Terms of Trade", type: "longText" },
      { key: "manifestLines", name: "Manifest of Order", type: "longText", options: { help: "One row per line: CLIN | Title | Description | Delivery | Freight #" } },
      { key: "packLines", name: "Pack Details", type: "longText", options: { help: "One row per line: CLIN | Pack Size | Pallet Config | Per Kit | Qty" } },
      // Fields of the previous voucher ledger layout. Kept so existing records lose nothing.
      { key: "voucherId", name: "Voucher ID", type: "text", options: { unique: true } },
      { key: "sp", name: "SP", type: "number", options: { format: "integer", min: 0 } },
      { key: "svc", name: "SVC", type: "text" },
      { key: "debit", name: "Debit", type: "number", options: { format: "currency", min: 0 } },
      { key: "credit", name: "Credit", type: "number", options: { format: "currency", min: 0 } },
      { key: "balance", name: "Balance", type: "number", options: { format: "currency" } },
      { key: "prefix", name: "Prefix", type: "text" },
      { key: "label", name: "Label", type: "text" },
      { key: "ref", name: "Legacy ID", type: "text" },
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
          order: [...VOUCHER_FEMA_ORDER],
          widths: {
            voucherNo: 140,
            accrualDate: 110,
            docType: 70,
            headline: 150,
            docStatus: 100,
            by: 70,
            vendorCode: 100,
            contractNo: 160,
            operatorCode: 100,
            reference2: 140,
            deliverVia: 80,
            resource: 120,
            tracking: 120,
            scans: 130,
            i: 90,
            no: 100,
            vsf: 170,
            manifest: 260,
            qr: 100,
            voucherNote: 180,
          },
        },
      },
      { key: "document", name: "Voucher Details", type: "grid", config: { sort: [{ field: "i", dir: "asc" }], hidden: [...VOUCHER_LEGACY_KEYS, "no", "vsf", "manifest", "qr", "consignee", "shipTo"] } },
      { key: "ledger", name: "Ledger (previous layout)", type: "grid", config: { hidden: ["manifest", "qr", "by", "reference2", ...VOUCHER_DOCUMENT_KEYS, "accrualDate", "docType", "headline", "docStatus", "vendorCode", "contractNo", "operatorCode", "deliverVia", "resource", "tracking", "voucherNote", "voucherNo"] } },
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
      { key: "style", name: "Style", type: "singleSelect", options: { ...sel(["Work", "Vouchers"], ["green", "orange"]), defaultValue: "Work", help: "What the form is for: Work or Vouchers." } },
      { key: "title", name: "Title", type: "text", required: true },
      { key: "longTitle", name: "Long Title", type: "text" },
      { key: "group", name: "Group", type: "singleSelect", options: sel(["Buy", "Blanket"], ["green", "cyan"]) },
      { key: "description", name: "Description", type: "longText" },
    ],
    views: [
      { key: "all", name: "All Forms", type: "grid", config: { groupBy: [{ field: "style", dir: "asc" }] } },
      { key: "work", name: "Work forms", type: "grid", config: { filters: [rule("r1", "style", "is", "Work")] } },
      { key: "vouchers", name: "Voucher forms", type: "grid", config: { filters: [rule("r1", "style", "is", "Vouchers")] } },
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
