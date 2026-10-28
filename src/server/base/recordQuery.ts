import { isIncomplete, opKind, OPS_WITH_LIST } from "@/lib/base/query";
import type { FieldDef, FilterRule, SortRule } from "@/lib/base/types";

/**
 * Filters, searches and sorts a table in PostgreSQL, so very large tables never have to be sent to the browser.
 * It mirrors the in-browser evaluator in `lib/base/query.ts` (the integration tests compare the two).
 *
 * Safety: field keys and every value are bound as parameters. Operators come from a fixed list. Only the column
 * alias `r` and constant SQL fragments are ever written into the statement text.
 *
 * Not supported on the server (the browser evaluates these on the loaded page instead): fields that are derived from
 * other tables ("folios in this category"). Search covers the stored values of text, number, date, select and
 * contact fields, not the labels of linked records.
 */
export class UnsupportedFilterError extends Error {}

export interface RecordQuery {
  filters: FilterRule[];
  search?: string;
  sort?: SortRule[];
  limit: number;
  offset: number;
}

class Params {
  readonly values: unknown[] = [];
  add(v: unknown): string {
    this.values.push(v);
    return `$${this.values.length}`;
  }
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);
const NUMERIC = "'^-?[0-9]+([.][0-9]+)?$'";

/** SQL snippets for one field. `k` is the parameter holding the field key. */
function exprs(f: FieldDef, p: Params) {
  const k = p.add(f.key);
  const text = `(r.data->>${k})`;
  const num = (t: string) => `(CASE WHEN ${t} ~ ${NUMERIC} THEN (${t})::numeric END)`;
  const json = `(r.data->${k})`;
  return { k, text, json, num: num(text), numOf: num };
}

/** Value of a field as text/number/jsonb for filters and sorts, including the whitelisted computed fields. */
function valueExpr(f: FieldDef, p: Params): { sql: string; kind: "text" | "number" | "json" } {
  if (f.type !== "computed") {
    const base = exprs(f, p);
    const kind = opKind(f);
    if (kind === "number") return { sql: base.num, kind: "number" };
    if (f.type === "multiSelect" || f.type === "attachment" || (f.type === "link" && f.options.multiple)) return { sql: base.json, kind: "json" };
    return { sql: base.text, kind: "text" };
  }
  const spec = f.options.computed;
  if (!spec || spec.fn === "linkedFrom") throw new UnsupportedFilterError(`“${f.name}” cannot be filtered on large tables.`);
  if (spec.fn === "offset") {
    const src = exprs({ ...f, key: spec.source }, p);
    return { sql: `(${src.num} + ${p.add(spec.add)}::numeric)`, kind: "number" };
  }
  if (spec.fn === "stockStatus") {
    const q = exprs({ ...f, key: spec.qty }, p).num;
    const re = exprs({ ...f, key: spec.reorder }, p).num;
    return { sql: `(CASE WHEN ${q} IS NULL THEN NULL WHEN ${q} <= 0 THEN 'Out of stock' WHEN ${re} > 0 AND ${q} <= ${re} THEN 'Low stock' ELSE 'In stock' END)`, kind: "text" };
  }
  if (spec.fn === "voucherNo") {
    const n = exprs({ ...f, key: spec.number }, p).num;
    const t = exprs({ ...f, key: spec.type }, p).text;
    return { sql: `(CASE WHEN ${n} IS NULL THEN NULL ELSE ${p.add(spec.prefix)} || COALESCE(NULLIF(${t}, ''), 'BL') || '-' || ((${n} + ${p.add(spec.offset)}::numeric)::bigint)::text END)`, kind: "text" };
  }
  // fileStatus
  const has = (key: string) => {
    const j = `(r.data->${p.add(key)})`;
    return `(CASE jsonb_typeof(${j}) WHEN 'array' THEN jsonb_array_length(${j}) > 0 WHEN 'string' THEN ${j} #>> '{}' <> '' ELSE false END)`;
  };
  return { sql: `(CASE WHEN ${has(spec.original)} THEN 'Original uploaded' WHEN ${has(spec.generated)} THEN 'Generated only' ELSE 'No PDF' END)`, kind: "text" };
}

function isEmptySql(f: FieldDef, p: Params): string {
  if (f.type === "checkbox") return `NOT COALESCE((r.data->${p.add(f.key)}) = 'true'::jsonb, false)`;
  if (f.type === "attachment") {
    const j = `(r.data->${p.add(f.key)})`;
    return `(CASE jsonb_typeof(${j}) WHEN 'array' THEN jsonb_array_length(${j}) = 0 WHEN 'string' THEN ${j} #>> '{}' = '' ELSE true END)`;
  }
  const v = valueExpr(f, p);
  if (v.kind === "json") return `(${v.sql} IS NULL OR ${v.sql} = 'null'::jsonb OR ${v.sql} = '[]'::jsonb)`;
  if (f.type === "link") {
    const legacy = f.options.legacyKey ? `COALESCE(btrim(r.data->>${p.add(f.options.legacyKey)}), '') = ''` : "TRUE";
    return `(COALESCE(btrim(${v.sql}), '') = '' AND ${legacy})`;
  }
  return v.kind === "number" ? `${v.sql} IS NULL` : `COALESCE(btrim(${v.sql}), '') = ''`;
}

function ruleSql(rule: FilterRule, f: FieldDef, p: Params): string {
  const kind = opKind(f);
  if (kind === "boolean") {
    const want = rule.value === true || rule.value === "true";
    return `(COALESCE((r.data->${p.add(f.key)}) = 'true'::jsonb, false) = ${want ? "TRUE" : "FALSE"})`;
  }
  if (rule.op === "isEmpty") return `(${isEmptySql(f, p)})`;
  if (rule.op === "isNotEmpty") return `(NOT (${isEmptySql(f, p)}))`;

  const v = valueExpr(f, p);
  const one = String(rule.value ?? "").trim();

  if (OPS_WITH_LIST.has(rule.op)) {
    const list = p.add((rule.values ?? []).map((x) => x.toLowerCase()));
    let hit: string;
    if (v.kind === "json") hit = `EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(${v.sql}) = 'array' THEN ${v.sql} ELSE '[]'::jsonb END) e WHERE lower(e) = ANY(${list}::text[]))`;
    else hit = `(lower(COALESCE(${v.sql}::text, '')) = ANY(${list}::text[]))`;
    return rule.op === "isAnyOf" ? `(${hit})` : `(NOT ${hit})`;
  }

  if (kind === "number") {
    const col = v.sql;
    if (rule.op === "between") {
      const lo = rule.value === null || rule.value === undefined || String(rule.value).trim() === "" ? null : Number(rule.value);
      const hi = rule.value2 === null || rule.value2 === undefined || String(rule.value2).trim() === "" ? null : Number(rule.value2);
      const parts = [`${col} IS NOT NULL`];
      if (lo !== null && Number.isFinite(lo)) parts.push(`${col} >= ${p.add(lo)}::numeric`);
      if (hi !== null && Number.isFinite(hi)) parts.push(`${col} <= ${p.add(hi)}::numeric`);
      return `(${parts.join(" AND ")})`;
    }
    const n = Number(one);
    if (!Number.isFinite(n)) return "TRUE";
    const sql = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[rule.op as "eq"];
    if (!sql) return "TRUE";
    // a record without a number is "not equal" to anything, and matches no other comparison
    return rule.op === "neq" ? `(${col} IS NULL OR ${col} <> ${p.add(n)}::numeric)` : `(${col} ${sql} ${p.add(n)}::numeric)`;
  }

  if (kind === "date") {
    const d = `left(COALESCE(${v.sql}, ''), 10)`;
    if (rule.op === "between") {
      const lo = String(rule.value ?? "").trim().slice(0, 10);
      const hi = String(rule.value2 ?? "").trim().slice(0, 10);
      const parts = [`${d} <> ''`];
      if (lo) parts.push(`${d} >= ${p.add(lo)}`);
      if (hi) parts.push(`${d} <= ${p.add(hi)}`);
      return `(${parts.join(" AND ")})`;
    }
    const sql = { is: "=", before: "<", after: ">" }[rule.op as "is"];
    if (!sql) return "TRUE";
    return `(${d} <> '' AND ${d} ${sql} ${p.add(one)})`;
  }

  if (kind === "link" || kind === "multi") {
    if (v.kind === "json") {
      const has = `COALESCE(${v.sql} ? ${p.add(one)}, false)`;
      return rule.op === "isNot" || rule.op === "notContains" ? `(NOT ${has})` : `(${has})`;
    }
  }

  // text, single select, single link, voucher number…
  const col = `COALESCE(${v.sql}::text, '')`;
  switch (rule.op) {
    case "contains": return `(${col} ILIKE ${p.add(`%${escapeLike(one)}%`)} ESCAPE '\\')`;
    case "notContains": return `(${col} NOT ILIKE ${p.add(`%${escapeLike(one)}%`)} ESCAPE '\\')`;
    case "is": return `(lower(${col}) = lower(${p.add(one)}))`;
    case "isNot": return `(lower(${col}) <> lower(${p.add(one)}))`;
    default: return "TRUE";
  }
}

function filtersSql(rules: FilterRule[], fields: FieldDef[], p: Params): string {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  let sql: string | null = null;
  for (const rule of rules) {
    const f = byKey.get(rule.field);
    if (!f || isIncomplete(rule)) continue;
    const part = ruleSql(rule, f, p);
    sql = sql === null ? part : `(${sql} ${rule.join === "or" ? "OR" : "AND"} ${part})`;
  }
  return sql ?? "TRUE";
}

function searchSql(search: string, fields: FieldDef[], p: Params): string {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  if (terms.length === 0) return "TRUE";
  const searchable = fields.filter((f) => ["text", "longText", "number", "date", "singleSelect", "multiSelect", "url", "email", "phone", "autonumber"].includes(f.type));
  if (searchable.length === 0) return "TRUE";
  const haystack = `lower(concat_ws(' ', ${searchable.map((f) => `r.data->>${p.add(f.key)}`).join(", ")}))`;
  return terms.map((t) => `${haystack} LIKE ${p.add(`%${escapeLike(t)}%`)} ESCAPE '\\'`).join(" AND ");
}

function orderSql(sort: SortRule[], fields: FieldDef[], p: Params): string {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const parts: string[] = [];
  for (const rule of sort.slice(0, 5)) {
    const f = byKey.get(rule.field);
    if (!f) continue;
    const dir = rule.dir === "desc" ? "DESC" : "ASC";
    if (f.type === "singleSelect" && f.options.choices?.length) {
      const names = p.add(f.options.choices.map((c) => c.name));
      parts.push(`array_position(${names}::text[], r.data->>${p.add(f.key)}) ${dir} NULLS LAST`);
      continue;
    }
    if (f.type === "checkbox") {
      parts.push(`(COALESCE((r.data->${p.add(f.key)}) = 'true'::jsonb, false)) ${dir}`);
      continue;
    }
    const v = valueExpr(f, p);
    if (v.kind === "json") continue;
    parts.push(v.kind === "number" ? `${v.sql} ${dir} NULLS LAST` : `NULLIF(lower(${v.sql}::text), '') ${dir} NULLS LAST`);
  }
  parts.push("g.position", "r.position", "r.record_id");
  return parts.join(", ");
}

export function buildRecordQuery(slug: string, fields: FieldDef[], q: RecordQuery): { text: string; values: unknown[] } {
  const p = new Params();
  const table = p.add(slug);
  const where = `r.section_slug = ${table} AND ${filtersSql(q.filters, fields, p)} AND ${searchSql(q.search ?? "", fields, p)}`;
  const order = orderSql(q.sort ?? [], fields, p);
  const limit = p.add(Math.max(1, Math.min(1000, Math.floor(q.limit))));
  const offset = p.add(Math.max(0, Math.floor(q.offset)));
  return {
    text: `SELECT r.data, COUNT(*) OVER()::int AS total
           FROM boss_records r JOIN boss_groups g ON g.section_slug = r.section_slug AND g.group_id = r.group_id
           WHERE ${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`,
    values: p.values,
  };
}
