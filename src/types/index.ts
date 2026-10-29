/** Shared shape for every table view. Only fields visible in the designs exist. */
export interface RecordGroup<T> {
  id: string;
  /** Group header label. Omit for ungrouped tables. */
  label?: string;
  /** Count shown in the header badge (the design's own figure, not always rows.length). */
  count?: number;
  rows: T[];
  /** Per-group sum row values keyed by column key (Folios, Transactions). */
  sums?: Record<string, string | number>;
}

export interface RecordSet<T> {
  groups: RecordGroup<T>[];
  /** Footer text "Showing {from}-{to} of {total} records" — as drawn in the design. */
  range?: { from: number; to: number; total: number };
}

export interface Profile {
  id: string;
  contact: string;
  sal: string | null;
  name: string;
  position: string;
  billing: "LLG" | "BOSS" | null;
  type: "Agent" | "Rep";
  email: string;
  address: string | null;
}

export interface CategoryRow {
  id: string;
  code: string;
  group: string;
  levelTwo: string | null;
  folios: string[];
}

export interface FolioRow {
  id: string;
  folio: string;
  cord: string | null;
  inactive: string | null;
  group: string | null;
  category: string | null;
  active: number | null;
  asfs: number | null;
  actions: string | null;
}

/** An action record. Its fields are defined in lib/base/definitions.ts (they follow the Actions export). */
export type ActionRow = { id: string } & Record<string, unknown>;

export interface VoucherRow {
  id: string;
  /** Autonumber ID from the FEMA sheet (column ID). */
  i?: number;
  accrualDate?: string;
  docType?: "FD" | "FT" | "BL" | "FQ" | "IN";
  headline?: string;
  docStatus?: "Issued" | "Planned" | "BOOKED";
  by?: string;
  vendorCode?: string;
  contractNo?: string;
  operatorCode?: string;
  reference2?: string;
  deliverVia?: string;
  resource?: string;
  tracking?: string;
  vsf?: string;
  manifest?: string;
  voucherNote?: string;
  // Legacy ledger columns (kept for older views).
  voucherId: string;
  sp: number;
  svc: string;
  debit: number;
  credit: number;
  balance: number;
  scans?: number;
  prefix: string;
  label: string;
  ref: string;
  sum: number;
  cover: string;
}

export interface TransactionRow {
  id: string;
  trans: string;
  voucher: string;
  custRef: string;
  accrue: string;
  acct: "COGS" | "SALES";
  item: string;
  memo: string;
  drQty: number;
  crQty: number;
  qty: number;
  direct: "Yes" | "No";
  detail: string;
}

export interface ItemRow {
  id: string;
  n: number;
  pic: string;
  title: string;
  overview: string;
  purstat: "Purchased";
  location: string;
  qty: number;
  kit: "Kit Alpha" | "Kit Beta" | "Kit Gamma" | "Kit Delta";
  assigned: string;
}

export interface FormRow {
  id: string;
  code: string;
  type: string;
  slug: string;
  style: "Work";
  title: string;
  longTitle: string;
  group: "Buy" | "Blanket";
  description: string;
}

export interface ConceptRow {
  id: string;
  title: string;
  release: string | null;
  acronym: string | null;
  type: "Course";
  definition: string | null;
  related: string | null;
  link: string;
  work: string[];
}

export interface CapabilityRow {
  id: string;
  code: string;
  title: string;
  overview: string;
  gallery: string;
  notes: string;
  attachment: string;
  features: string[];
  tagline: string;
}

export interface LeadRow {
  id: string;
  leadId: string;
  client: string;
  title: string;
  type: "Solicitation" | "Sources Sought" | "Combined Syn/Solicitation" | "Request for Information";
  due: string;
  hasFiles: boolean;
  url: string;
}

