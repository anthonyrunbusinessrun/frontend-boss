import type { FieldDef, FieldValueType } from "@/components/popovers/fields";
import type { RecordGroup } from "@/types";

/* ------------------------------------------------------------------ *
 * Pure table logic (search, filter, sort, pagination). No React here so
 * it can be unit-tested and later replaced by server-side query params.
 * ------------------------------------------------------------------ */

export type SortDir = "asc" | "desc";
export interface SortRule {
  field: string;
  dir: SortDir;
}

export type FilterOp = "contains" | "notContains" | "is" | "isNot" | "isEmpty" | "isNotEmpty" | "eq" | "neq" | "gt" | "gte" | "lt" | "lte";

export interface FilterCondition {
  id: number;
  join: "and" | "or";
  field: string;
  op: FilterOp;
  value: string | boolean;
}

export const OPS_BY_TYPE: Record<FieldValueType, Array<{ op: FilterOp; label: string }>> = {
  text: [
    { op: "contains", label: "contains" },
    { op: "notContains", label: "does not contain" },
    { op: "is", label: "is" },
    { op: "isNot", label: "is not" },
    { op: "isEmpty", label: "is empty" },
    { op: "isNotEmpty", label: "is not empty" },
  ],
  list: [
    { op: "contains", label: "contains" },
    { op: "notContains", label: "does not contain" },
    { op: "isEmpty", label: "is empty" },
    { op: "isNotEmpty", label: "is not empty" },
  ],
  number: [
    { op: "eq", label: "=" },
    { op: "neq", label: "≠" },
    { op: "gt", label: ">" },
    { op: "gte", label: "≥" },
    { op: "lt", label: "<" },
    { op: "lte", label: "≤" },
    { op: "isEmpty", label: "is empty" },
    { op: "isNotEmpty", label: "is not empty" },
  ],
  date: [
    { op: "is", label: "is" },
    { op: "gt", label: "is after" },
    { op: "lt", label: "is before" },
    { op: "isEmpty", label: "is empty" },
    { op: "isNotEmpty", label: "is not empty" },
  ],
  boolean: [{ op: "is", label: "is" }],
};

export const OPS_WITHOUT_VALUE: ReadonlySet<FilterOp> = new Set(["isEmpty", "isNotEmpty"]);

export function fieldType(f: FieldDef): FieldValueType {
  return f.type ?? (f.kind === "checkbox" ? "boolean" : "text");
}

/** A field can be evaluated against rows only when it names a property or accessor. */
export function isEvaluable(f: FieldDef): boolean {
  return f.key !== undefined || f.get !== undefined;
}

export function readField(row: unknown, f: FieldDef): unknown {
  if (f.get) return (f.get as (r: unknown) => unknown)(row);
  if (f.key === undefined) return undefined;
  return (row as Record<string, unknown>)[f.key];
}

const isBlank = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

function asText(v: unknown): string {
  if (isBlank(v)) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

/* ---------------------------- search ---------------------------- */

const SEARCH_SKIP = new Set(["id", "pic", "cover"]);
const searchCache = new WeakMap<object, string>();

/** Lower-cased text of every primitive value on the row, cached per row object. */
export function rowSearchText(row: unknown): string {
  if (typeof row !== "object" || row === null) return String(row ?? "").toLowerCase();
  const cached = searchCache.get(row);
  if (cached !== undefined) return cached;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(row)) {
    if (SEARCH_SKIP.has(k) || v === null || v === undefined || typeof v === "boolean") continue;
    if (Array.isArray(v)) parts.push(v.join(" "));
    else if (typeof v !== "object") parts.push(String(v));
  }
  const text = parts.join(" ").toLowerCase();
  searchCache.set(row, text);
  return text;
}

export function matchesSearch(row: unknown, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = rowSearchText(row);
  return terms.every((t) => text.includes(t));
}

/* ---------------------------- filter ---------------------------- */

function numeric(v: unknown): number | null {
  if (isBlank(v)) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isNaN(n) ? null : n;
}

function evaluateCondition(row: unknown, c: FilterCondition, f: FieldDef): boolean | null {
  const type = fieldType(f);
  const raw = readField(row, f);

  if (type === "boolean") return Boolean(raw) === (c.value === true || c.value === "true");

  if (c.op === "isEmpty") return isBlank(raw);
  if (c.op === "isNotEmpty") return !isBlank(raw);

  const wanted = String(c.value ?? "").trim();
  // An operator that needs a value is ignored until one is typed, so the table does not blank out mid-edit.
  if (wanted === "") return null;

  if (type === "number") {
    const a = numeric(raw);
    const b = numeric(wanted);
    if (b === null) return null;
    if (a === null) return c.op === "neq";
    switch (c.op) {
      case "eq": return a === b;
      case "neq": return a !== b;
      case "gt": return a > b;
      case "gte": return a >= b;
      case "lt": return a < b;
      case "lte": return a <= b;
      default: return null;
    }
  }

  const text = asText(raw).toLowerCase();
  const target = wanted.toLowerCase();
  switch (c.op) {
    case "contains": return text.includes(target);
    case "notContains": return !text.includes(target);
    case "is": return text === target;
    case "isNot": return text !== target;
    case "gt": return text > target;
    case "lt": return text < target;
    default: return null;
  }
}

export function applyFilters<T>(rows: T[], conditions: FilterCondition[], fields: FieldDef[]): T[] {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const active = conditions.filter((c) => {
    const f = byName.get(c.field);
    return f !== undefined && isEvaluable(f);
  });
  if (active.length === 0) return rows;
  return rows.filter((row) => {
    let result: boolean | null = null;
    for (const c of active) {
      const outcome = evaluateCondition(row, c, byName.get(c.field)!);
      if (outcome === null) continue;
      result = result === null ? outcome : c.join === "or" ? result || outcome : result && outcome;
    }
    return result ?? true;
  });
}

/* ----------------------------- sort ----------------------------- */

export function compareValues(a: unknown, b: unknown, type: FieldValueType): number {
  const aBlank = isBlank(a);
  const bBlank = isBlank(b);
  if (aBlank || bBlank) return aBlank === bBlank ? 0 : aBlank ? 1 : -1; // blanks last
  if (type === "number") return (numeric(a) ?? 0) - (numeric(b) ?? 0);
  if (type === "boolean") return Number(Boolean(a)) - Number(Boolean(b));
  return asText(a).localeCompare(asText(b), undefined, { numeric: true, sensitivity: "base" });
}

export function applySort<T>(rows: T[], rules: SortRule[], fields: FieldDef[]): T[] {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const usable = rules.flatMap((r) => {
    const f = byName.get(r.field);
    return f && isEvaluable(f) ? [{ f, dir: r.dir === "asc" ? 1 : -1, type: fieldType(f) }] : [];
  });
  if (usable.length === 0) return rows;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      for (const u of usable) {
        const diff = compareValues(readField(x.row, u.f), readField(y.row, u.f), u.type);
        // Blanks stay last in both directions.
        const blankDiff = isBlank(readField(x.row, u.f)) || isBlank(readField(y.row, u.f));
        if (diff !== 0) return blankDiff ? diff : diff * u.dir;
      }
      return x.index - y.index;
    })
    .map((x) => x.row);
}

/* ------------------------ view computation ------------------------ */

export interface ViewQuery {
  fields: FieldDef[];
  search: string;
  sort: SortRule[];
  conditions: FilterCondition[];
  page: number;
  pageSize: number;
}

export interface ComputedView<T> {
  groups: RecordGroup<T>[];
  /** Rows after search + filters (before paging). */
  matched: number;
  /** Rows before search + filters. */
  total: number;
  filtered: boolean;
  page: number;
  pages: number;
  from: number;
  to: number;
}

export function computeView<T>(source: RecordGroup<T>[], q: ViewQuery): ComputedView<T> {
  const total = source.reduce((n, g) => n + g.rows.length, 0);
  const searching = q.search.trim() !== "";
  const hasConditions = q.conditions.some((c) => {
    const f = q.fields.find((x) => x.name === c.field);
    return f !== undefined && isEvaluable(f);
  });
  const filtered = searching || hasConditions;

  const processed = source.map((g) => {
    let rows = g.rows;
    if (searching) rows = rows.filter((r) => matchesSearch(r, q.search));
    if (hasConditions) rows = applyFilters(rows, q.conditions, q.fields);
    rows = applySort(rows, q.sort, q.fields);
    return { ...g, rows };
  });

  const matched = processed.reduce((n, g) => n + g.rows.length, 0);
  const pages = Math.max(1, Math.ceil(matched / q.pageSize));
  const page = Math.min(Math.max(1, q.page), pages);
  const start = (page - 1) * q.pageSize;
  const end = start + q.pageSize;

  let cursor = 0;
  const paged: RecordGroup<T>[] = [];
  for (const g of processed) {
    const slice = g.rows.slice(Math.max(0, start - cursor), Math.max(0, end - cursor));
    cursor += g.rows.length;
    const keepEmpty = !filtered && pages === 1; // untouched views keep empty groups, as drawn
    if (slice.length === 0 && !keepEmpty) continue;
    paged.push({ ...g, rows: slice, count: filtered ? g.rows.length : g.count });
  }

  return {
    groups: paged,
    matched,
    total,
    filtered,
    page,
    pages,
    from: matched === 0 ? 0 : start + 1,
    to: Math.min(end, matched),
  };
}
