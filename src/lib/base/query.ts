import { displayText, fieldValue, linkIds, toNumber, type LinkLookup } from "./compute";
import { readAttachments } from "./fields";
import type { FieldDef, FilterOp, FilterRule, GroupRule, RecordRow, SortRule, ViewConfig } from "./types";

/* ------------------------------ operators ------------------------------ */

type OpKind = "text" | "number" | "date" | "boolean" | "select" | "multi" | "link" | "attachment";

export function opKind(field: FieldDef): OpKind {
  switch (field.type) {
    case "number":
    case "autonumber":
      return "number";
    case "computed": {
      const fn = field.options.computed?.fn;
      return fn === "offset" ? "number" : fn === "linkedFrom" ? "multi" : "select";
    }
    case "date":
      return "date";
    case "checkbox":
      return "boolean";
    case "singleSelect":
      return "select";
    case "multiSelect":
      return "multi";
    case "link":
      return "link";
    case "attachment":
      return "attachment";
    default:
      return "text";
  }
}

const EMPTY_OPS: Array<{ op: FilterOp; label: string }> = [
  { op: "isEmpty", label: "is empty" },
  { op: "isNotEmpty", label: "is not empty" },
];

export const OPS_BY_KIND: Record<OpKind, Array<{ op: FilterOp; label: string }>> = {
  text: [
    { op: "contains", label: "contains" },
    { op: "notContains", label: "does not contain" },
    { op: "is", label: "is" },
    { op: "isNot", label: "is not" },
    ...EMPTY_OPS,
  ],
  number: [
    { op: "eq", label: "=" },
    { op: "neq", label: "≠" },
    { op: "gt", label: ">" },
    { op: "gte", label: "≥" },
    { op: "lt", label: "<" },
    { op: "lte", label: "≤" },
    ...EMPTY_OPS,
  ],
  date: [
    { op: "is", label: "is" },
    { op: "before", label: "is before" },
    { op: "after", label: "is after" },
    ...EMPTY_OPS,
  ],
  boolean: [{ op: "is", label: "is" }],
  select: [
    { op: "is", label: "is" },
    { op: "isNot", label: "is not" },
    ...EMPTY_OPS,
  ],
  multi: [
    { op: "contains", label: "has" },
    { op: "notContains", label: "does not have" },
    ...EMPTY_OPS,
  ],
  link: [
    { op: "is", label: "is" },
    { op: "isNot", label: "is not" },
    ...EMPTY_OPS,
  ],
  attachment: EMPTY_OPS,
};

export const opsFor = (field: FieldDef) => OPS_BY_KIND[opKind(field)];
export const OPS_WITHOUT_VALUE: ReadonlySet<FilterOp> = new Set(["isEmpty", "isNotEmpty"]);

export function defaultRule(id: string, field: FieldDef): FilterRule {
  const kind = opKind(field);
  return { id, join: "and", field: field.key, op: OPS_BY_KIND[kind][0].op, value: kind === "boolean" ? true : "" };
}

/* ------------------------------ helpers ------------------------------ */

export const isBlank = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

function isEmptyValue(field: FieldDef, row: RecordRow, linked: LinkLookup): boolean {
  const v = fieldValue(field, row, linked);
  if (field.type === "checkbox") return !v;
  if (field.type === "attachment") return readAttachments(v).length === 0;
  if (field.type === "link") {
    if (linkIds(v).length > 0) return false;
    const legacy = field.options.legacyKey ? row[field.options.legacyKey] : undefined;
    return isBlank(legacy);
  }
  return isBlank(v);
}

/** null = the rule is incomplete (e.g. a value is still being typed) and must not hide rows. */
function evaluate(rule: FilterRule, field: FieldDef, row: RecordRow, linked: LinkLookup): boolean | null {
  const kind = opKind(field);
  if (kind === "boolean") return Boolean(fieldValue(field, row, linked)) === (rule.value === true || rule.value === "true");
  if (rule.op === "isEmpty") return isEmptyValue(field, row, linked);
  if (rule.op === "isNotEmpty") return !isEmptyValue(field, row, linked);

  const wantedRaw = rule.value === null || rule.value === undefined ? "" : String(rule.value).trim();
  if (wantedRaw === "") return null;

  const raw = fieldValue(field, row, linked);

  if (kind === "number") {
    const a = toNumber(raw);
    const b = toNumber(wantedRaw);
    if (b === null) return null;
    if (a === null) return rule.op === "neq";
    switch (rule.op) {
      case "eq": return a === b;
      case "neq": return a !== b;
      case "gt": return a > b;
      case "gte": return a >= b;
      case "lt": return a < b;
      case "lte": return a <= b;
      default: return null;
    }
  }

  if (kind === "date") {
    const a = typeof raw === "string" ? raw.slice(0, 10) : "";
    if (a === "") return rule.op === "isNot";
    switch (rule.op) {
      case "is": return a === wantedRaw;
      case "before": return a < wantedRaw;
      case "after": return a > wantedRaw;
      default: return null;
    }
  }

  if (kind === "link") {
    const ids = linkIds(raw);
    if (rule.op === "is") return ids.includes(wantedRaw);
    if (rule.op === "isNot") return !ids.includes(wantedRaw);
    return null;
  }

  if (kind === "multi") {
    const list = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
    const has = list.some((x) => x.toLowerCase() === wantedRaw.toLowerCase());
    if (rule.op === "contains") return has;
    if (rule.op === "notContains") return !has;
    return null;
  }

  const text = displayText(field, row, linked).toLowerCase();
  const target = wantedRaw.toLowerCase();
  switch (rule.op) {
    case "contains": return text.includes(target);
    case "notContains": return !text.includes(target);
    case "is": return text === target;
    case "isNot": return text !== target;
    default: return null;
  }
}

export function applyFilters(rows: RecordRow[], rules: FilterRule[], fields: FieldDef[], linked: LinkLookup = {}): RecordRow[] {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const usable = rules.filter((r) => byKey.has(r.field));
  if (usable.length === 0) return rows;
  return rows.filter((row) => {
    let result: boolean | null = null;
    for (const rule of usable) {
      const outcome = evaluate(rule, byKey.get(rule.field)!, row, linked);
      if (outcome === null) continue;
      result = result === null ? outcome : rule.join === "or" ? result || outcome : result && outcome;
    }
    return result ?? true;
  });
}

/* ------------------------------ search ------------------------------ */

export function matchesSearch(row: RecordRow, query: string, fields: FieldDef[], linked: LinkLookup = {}): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = fields
    .filter((f) => f.type !== "attachment")
    .map((f) => displayText(f, row, linked))
    .join(" ")
    .toLowerCase();
  return terms.every((t) => text.includes(t));
}

/* ------------------------------ sort ------------------------------ */

function sortKey(field: FieldDef, row: RecordRow, linked: LinkLookup): { blank: boolean; num?: number; text?: string } {
  const v = fieldValue(field, row, linked);
  switch (field.type) {
    case "number":
    case "autonumber": {
      const n = toNumber(v);
      return n === null ? { blank: true } : { blank: false, num: n };
    }
    case "computed": {
      if (typeof v === "number") return { blank: false, num: v };
      return v === null || v === undefined || v === "" ? { blank: true } : { blank: false, text: String(v) };
    }
    case "checkbox":
      return { blank: false, num: v ? 1 : 0 };
    case "singleSelect": {
      if (isBlank(v)) return { blank: true };
      const idx = field.options.choices?.findIndex((c) => c.name === v) ?? -1;
      return idx >= 0 ? { blank: false, num: idx } : { blank: false, num: 10_000, text: String(v) };
    }
    default: {
      const t = displayText(field, row, linked);
      return t === "" ? { blank: true } : { blank: false, text: t };
    }
  }
}

export function applySort(rows: RecordRow[], rules: SortRule[], fields: FieldDef[], linked: LinkLookup = {}): RecordRow[] {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const usable = rules.flatMap((r) => (byKey.has(r.field) ? [{ f: byKey.get(r.field)!, dir: r.dir === "desc" ? -1 : 1 }] : []));
  if (usable.length === 0) return rows;
  return rows
    .map((row, index) => ({ row, index, keys: usable.map((u) => sortKey(u.f, row, linked)) }))
    .sort((x, y) => {
      for (let i = 0; i < usable.length; i += 1) {
        const a = x.keys[i];
        const b = y.keys[i];
        if (a.blank || b.blank) {
          if (a.blank !== b.blank) return a.blank ? 1 : -1; // blanks last in both directions
          continue;
        }
        let diff = 0;
        if (a.num !== undefined && b.num !== undefined && a.num !== b.num) diff = a.num - b.num;
        else if (a.text !== undefined && b.text !== undefined) diff = a.text.localeCompare(b.text, undefined, { numeric: true, sensitivity: "base" });
        if (diff !== 0) return diff * usable[i].dir;
      }
      return x.index - y.index;
    })
    .map((x) => x.row);
}

/* ------------------------------ group ------------------------------ */

export interface RowGroup {
  /** Stable key (path of group values). */
  key: string;
  label: string;
  /** Field the group is on, for headers. */
  field?: FieldDef;
  value?: unknown;
  depth: number;
  rows: RecordRow[];
  children?: RowGroup[];
}

function groupValueLabel(field: FieldDef, row: RecordRow, linked: LinkLookup): string {
  if (field.type === "checkbox") return fieldValue(field, row, linked) ? "Checked" : "Unchecked";
  const t = displayText(field, row, linked);
  return t === "" ? "Empty" : t;
}

export function applyGroups(rows: RecordRow[], rules: GroupRule[], fields: FieldDef[], linked: LinkLookup = {}, depth = 0, parentKey = ""): RowGroup[] {
  const rule = rules[0];
  const field = rule ? fields.find((f) => f.key === rule.field) : undefined;
  if (!rule || !field) return [{ key: "all", label: "", depth: 0, rows }];

  const map = new Map<string, RowGroup>();
  for (const row of rows) {
    const label = groupValueLabel(field, row, linked);
    const key = `${parentKey}/${field.key}:${label}`;
    let g = map.get(label);
    if (!g) {
      g = { key, label, field, value: fieldValue(field, row, linked), depth, rows: [] };
      map.set(label, g);
    }
    g.rows.push(row);
  }

  let groups = [...map.values()];
  const order = (g: RowGroup): number => {
    if (field.type === "singleSelect") {
      const idx = field.options.choices?.findIndex((c) => c.name === g.value) ?? -1;
      return g.label === "Empty" ? 1e6 : idx >= 0 ? idx : 1e5;
    }
    if (field.type === "checkbox") return g.value ? 1 : 0;
    return 0;
  };
  groups.sort((a, b) => {
    const emptyA = a.label === "Empty";
    const emptyB = b.label === "Empty";
    if (emptyA !== emptyB) return emptyA ? 1 : -1;
    const o = order(a) - order(b);
    if (o !== 0) return rule.dir === "desc" ? -o : o;
    const c = a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
    return rule.dir === "desc" ? -c : c;
  });
  groups = groups.map((g) => (rules.length > 1 ? { ...g, children: applyGroups(g.rows, rules.slice(1), fields, linked, depth + 1, g.key) } : g));
  return groups;
}

/** Search + filter + sort for a view. Grouping is applied separately by the grid. */
export function queryRecords(records: RecordRow[], config: Pick<ViewConfig, "filters" | "sort">, fields: FieldDef[], search: string, linked: LinkLookup = {}): RecordRow[] {
  let rows = records;
  if (search.trim() !== "") rows = rows.filter((r) => matchesSearch(r, search, fields, linked));
  rows = applyFilters(rows, config.filters, fields, linked);
  return applySort(rows, config.sort, fields, linked);
}

/** Fields a view shows, in the view's order, minus hidden ones. */
export function visibleFields(fields: FieldDef[], config: Pick<ViewConfig, "hidden" | "order">): FieldDef[] {
  const hidden = new Set(config.hidden);
  const order = config.order ?? [];
  const rank = new Map(order.map((k, i) => [k, i]));
  return fields
    .filter((f) => !hidden.has(f.key))
    .map((f, i) => ({ f, r: rank.has(f.key) ? rank.get(f.key)! : order.length + i }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.f);
}
