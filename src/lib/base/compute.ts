import { readAttachments } from "./fields";
import type { FieldDef, LinkedTable, RecordRow } from "./types";

export type LinkLookup = Record<string, LinkedTable | undefined>;

export type StockStatus = "In stock" | "Low stock" | "Out of stock";

/** Quantity 0 (or below) is out of stock; at or below the reorder level is low. No reorder level means no "low" state. */
export function stockStatus(qty: unknown, reorder: unknown): StockStatus | null {
  const q = toNumber(qty);
  if (q === null) return null;
  if (q <= 0) return "Out of stock";
  const r = toNumber(reorder);
  if (r !== null && r > 0 && q <= r) return "Low stock";
  return "In stock";
}

/** "LLG-FD-15574": prefix + document type + (autonumber + offset). Blank until the voucher has a number. */
export function voucherNumber(spec: { number: string; type: string; prefix: string; offset: number }, row: RecordRow): string | null {
  const n = toNumber(row[spec.number]);
  if (n === null) return null;
  const type = typeof row[spec.type] === "string" && row[spec.type] ? String(row[spec.type]) : "BL";
  return `${spec.prefix}${type}-${n + spec.offset}`;
}

export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Value of a field for a record, evaluating computed fields. */
export function fieldValue(field: FieldDef, row: RecordRow, linked: LinkLookup = {}): unknown {
  if (field.type !== "computed") return row[field.key];
  const spec = field.options.computed;
  if (!spec) return null;
  if (spec.fn === "linkedFrom") {
    const table = linked[spec.table];
    if (!table) return [];
    return table.records.filter((r) => linkIds(r.filter[spec.key]).includes(row.id)).map((r) => r.label);
  }
  if (spec.fn === "offset") {
    const n = toNumber(row[spec.source]);
    return n === null ? null : n + spec.add;
  }
  if (spec.fn === "stockStatus") return stockStatus(row[spec.qty], row[spec.reorder]);
  if (spec.fn === "voucherNo") return voucherNumber(spec, row);
  return null;
}

export function linkLabel(field: FieldDef, id: unknown, linked: LinkLookup): string {
  const table = field.options.linkTable ? linked[field.options.linkTable] : undefined;
  return table?.records.find((r) => r.id === id)?.label ?? "";
}

export function linkIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v !== "");
  return typeof value === "string" && value !== "" ? [value] : [];
}

export function formatNumber(field: FieldDef, value: unknown): string {
  const n = toNumber(value);
  if (n === null) return "";
  const { format = "decimal", precision } = field.options;
  const digits = precision ?? (format === "integer" ? 0 : format === "currency" ? 2 : undefined);
  const opts: Intl.NumberFormatOptions = digits === undefined ? { maximumFractionDigits: 6 } : { minimumFractionDigits: digits, maximumFractionDigits: digits };
  if (format === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", ...opts }).format(n);
  if (format === "percent") return `${new Intl.NumberFormat("en-US", opts).format(n)}%`;
  return new Intl.NumberFormat("en-US", opts).format(n);
}

/** Plain-text rendering of a value: used for search, grouping, sorting by text and CSV-like output. */
export function displayText(field: FieldDef, row: RecordRow, linked: LinkLookup = {}): string {
  const value = fieldValue(field, row, linked);
  switch (field.type) {
    case "checkbox":
      return value ? "Yes" : "No";
    case "number":
    case "autonumber":
      return field.type === "number" ? formatNumber(field, value) : value === null || value === undefined ? "" : String(value);
    case "computed":
      if (Array.isArray(value)) return value.join(", ");
      return typeof value === "number" ? String(value) : value === null || value === undefined ? "" : String(value);
    case "multiSelect":
      return Array.isArray(value) ? value.join(", ") : value ? String(value) : "";
    case "attachment":
      return readAttachments(value)
        .map((a) => a.name)
        .join(", ");
    case "link": {
      const ids = linkIds(value);
      const labels = ids.map((id) => linkLabel(field, id, linked)).filter(Boolean);
      if (labels.length > 0) return labels.join(", ");
      const legacy = field.options.legacyKey ? row[field.options.legacyKey] : undefined;
      return typeof legacy === "string" ? legacy : "";
    }
    default:
      return value === null || value === undefined ? "" : String(value);
  }
}
