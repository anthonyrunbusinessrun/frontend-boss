import type { RecordRow } from "./types";

/**
 * Voucher document settings and helpers shared by the browser and the PDF generator.
 * The letterhead and the L / FD marks are copied from the supplied sample voucher (LLG-FD-15574).
 */
export const VOUCHER_LETTERHEAD = {
  company: "Land Logistics",
  tagline: "Inspired Solutions in a World of Challenges.",
  lines: ["POST OFFICE BOX 214", "BRANFORD, FLORIDA 32008", "+1 (202) 875-2320", "RAYLAND.COM"],
  footerName: "LAND LOGISTICS",
  footerAddress: "304 Suwannee Avenue Branford, Florida 32008",
  /** Voucher number = prefix + type + (autonumber I + offset): I 11574 with type FD gives LLG-FD-15574. */
  prefix: "LLG-",
  numberOffset: 4000,
};

export type VoucherDocType = "FD" | "BL";

/** Wording and marks that depend on the document type. */
export const VOUCHER_TYPES: Record<VoucherDocType, { title: string; defaultHeadline: string; mark: string; label: string }> = {
  FD: { title: "Freight Delivery Confirmation", defaultHeadline: "FREIGHT DELIVERY", mark: "L", label: "Freight Delivery Confirmation" },
  BL: { title: "Original | Non Negotiable", defaultHeadline: "BILL OF LADING", mark: "R", label: "Bill of Lading" },
};

export const MANIFEST_COLUMNS = ["CLIN", "Title", "Description", "Delivery", "Freight #"] as const;
export const PACK_COLUMNS = ["CLIN", "Pack Size", "Pallet Config", "Per Kit", "Qty", "Destination"] as const;

/** "a | b | c" per line into cells. Missing cells are empty; extra cells are folded into the last column. */
export function parseRows(text: unknown, columns: number): string[][] {
  if (typeof text !== "string") return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = line.split("|").map((c) => c.trim());
      const head = cells.slice(0, columns - 1);
      const tail = cells.slice(columns - 1).join(" | ");
      const row = [...head, tail];
      while (row.length < columns) row.push("");
      return row;
    });
}

/** Inverse of parseRows, used by the editor's help text and tests. */
export const joinRows = (rows: string[][]) => rows.map((r) => r.join(" | ")).join("\n");

export function docTypeOf(record: RecordRow): VoucherDocType {
  return record.docType === "FD" ? "FD" : "BL";
}

export function voucherNumber(record: RecordRow): string {
  const n = typeof record.i === "number" ? record.i : Number(record.i);
  if (!Number.isFinite(n)) return "";
  return `${VOUCHER_LETTERHEAD.prefix}${docTypeOf(record)}-${n + VOUCHER_LETTERHEAD.numberOffset}`;
}

/** 2026-07-09 -> 7/9/2026, as printed on the voucher. */
export function formatVoucherDate(iso: unknown): string {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${m}/${d}/${y}`;
}

/**
 * The voucher document shown for every voucher: the PDF supplied with the project (public/vouchers/Voucher.pdf).
 * The app does not create, edit, upload or replace voucher PDFs.
 */
export const VOUCHER_DOCUMENT = { url: "/vouchers/Voucher.pdf", name: "Voucher.pdf" } as const;
