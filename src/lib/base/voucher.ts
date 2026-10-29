import type { RecordRow } from "./types";

/**
 * Voucher numbering and small helpers. The document itself (what is printed where) is `voucherDocument.ts`.
 */
export const VOUCHER_LETTERHEAD = {
  /** Voucher number = prefix + Form + (ID + offset): ID 11574 with Form FD gives LLG-FD-15574. */
  prefix: "LLG-",
  numberOffset: 4000,
};

export const MANIFEST_COLUMNS = ["CLIN", "Title", "Description", "Delivery", "Freight #"] as const;
export const PACK_COLUMNS = ["CLIN", "Pack Size", "Pallet Config", "Per Kit", "Qty"] as const;

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

/** The voucher's Form code (FD, FT, BL, FQ, IN…). A voucher without one is treated as a Bill of Lading. */
export function docTypeOf(record: RecordRow): string {
  return typeof record.docType === "string" && record.docType ? record.docType : "BL";
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
