import { CHOICE_COLORS, FIELD_TYPES, type Choice, type FieldDef, type FieldOptions, type FieldType, type FilterOp, type FilterRule, type FormConfig, type ViewConfig } from "./types";
import { emptyViewConfig } from "./types";
import { fallbackColor, newId } from "./fields";
import { pruneConfig } from "./viewDefaults";

const OPS: ReadonlySet<string> = new Set<FilterOp>(["contains", "notContains", "is", "isNot", "isEmpty", "isNotEmpty", "eq", "neq", "gt", "gte", "lt", "lte", "before", "after"]);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 200): string | undefined => (typeof v === "string" ? v.slice(0, max) : undefined);
const strList = (v: unknown, max = 200): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : []);

/**
 * Coerce an untrusted object into a valid ViewConfig for a table, dropping anything unknown.
 * References to fields that do not exist are removed so a view never points at a deleted field.
 */
export function normalizeViewConfig(raw: unknown, fields: FieldDef[]): ViewConfig {
  const input = isObj(raw) ? raw : {};
  const cfg = emptyViewConfig();

  if (Array.isArray(input.filters)) {
    cfg.filters = input.filters.slice(0, 50).flatMap((f): FilterRule[] => {
      if (!isObj(f) || typeof f.field !== "string" || typeof f.op !== "string" || !OPS.has(f.op)) return [];
      const value = f.value;
      return [
        {
          id: str(f.id, 40) ?? newId("flt"),
          join: f.join === "or" ? "or" : "and",
          field: f.field,
          op: f.op as FilterOp,
          value: typeof value === "string" ? value.slice(0, 500) : typeof value === "number" || typeof value === "boolean" ? value : null,
        },
      ];
    });
  }
  if (Array.isArray(input.sort)) cfg.sort = input.sort.slice(0, 10).flatMap((s) => (isObj(s) && typeof s.field === "string" ? [{ field: s.field, dir: s.dir === "desc" ? ("desc" as const) : ("asc" as const) }] : []));
  if (Array.isArray(input.groupBy)) cfg.groupBy = input.groupBy.slice(0, 3).flatMap((s) => (isObj(s) && typeof s.field === "string" ? [{ field: s.field, dir: s.dir === "desc" ? ("desc" as const) : ("asc" as const) }] : []));
  cfg.hidden = strList(input.hidden);
  if (Array.isArray(input.order)) cfg.order = strList(input.order);
  if (isObj(input.widths)) {
    cfg.widths = {};
    for (const [k, v] of Object.entries(input.widths)) if (typeof v === "number" && Number.isFinite(v)) cfg.widths[k] = Math.min(800, Math.max(60, Math.round(v)));
  }
  cfg.key = str(input.key, 60);

  for (const k of ["dateField", "endDateField", "coverField", "stackField", "startField", "endField", "dependencyField", "colorField", "titleField"] as const) cfg[k] = str(input[k], 80);
  cfg.cardSize = input.cardSize === "small" || input.cardSize === "large" ? input.cardSize : input.cardSize === "medium" ? "medium" : undefined;
  if (typeof input.hideEmptyStacks === "boolean") cfg.hideEmptyStacks = input.hideEmptyStacks;

  if (isObj(input.form)) {
    const f = input.form;
    const form: FormConfig = {
      title: str(f.title, 200) ?? "",
      description: str(f.description, 2000) ?? "",
      submitLabel: str(f.submitLabel, 60) || "Submit",
      successMessage: str(f.successMessage, 500) ?? "",
      fields: Array.isArray(f.fields)
        ? f.fields.slice(0, 200).flatMap((x) => (isObj(x) && typeof x.key === "string" ? [{ key: x.key, visible: x.visible !== false, required: x.required === true, label: str(x.label, 120) || undefined, help: str(x.help, 300) || undefined }] : []))
        : [],
    };
    cfg.form = form;
  }

  // Field references only make sense for fields that exist.
  const pruned = pruneConfig(cfg, fields);
  // Date / select field references must also have the right type, otherwise views could be pointed at a text column.
  const typeOf = new Map(fields.map((f) => [f.key, f.type]));
  const need = (k: string | undefined, ...types: FieldType[]) => (k && types.includes(typeOf.get(k) as FieldType) ? k : undefined);
  pruned.dateField = need(pruned.dateField, "date");
  pruned.endDateField = need(pruned.endDateField, "date");
  pruned.startField = need(pruned.startField, "date");
  pruned.endField = need(pruned.endField, "date");
  pruned.stackField = need(pruned.stackField, "singleSelect");
  pruned.coverField = need(pruned.coverField, "attachment");
  pruned.dependencyField = need(pruned.dependencyField, "link");
  pruned.colorField = need(pruned.colorField, "singleSelect");
  return pruned;
}

/* ------------------------------------------------------------------ field options */

const FORMATS = new Set(["integer", "decimal", "currency", "percent"]);

function finiteNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function normalizeChoices(raw: unknown): Choice[] {
  if (!Array.isArray(raw)) return [];
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  const out: Choice[] = [];
  for (const c of raw.slice(0, 200)) {
    if (!isObj(c) || typeof c.name !== "string") continue;
    const name = c.name.trim().slice(0, 100);
    if (!name || seenNames.has(name.toLowerCase())) continue;
    seenNames.add(name.toLowerCase());
    let id = typeof c.id === "string" && c.id ? c.id.slice(0, 60) : newId("ch");
    if (seenIds.has(id)) id = newId("ch");
    seenIds.add(id);
    const color = (CHOICE_COLORS as readonly string[]).includes(c.color as string) ? (c.color as Choice["color"]) : fallbackColor(name);
    out.push({ id, name, color });
  }
  return out;
}

/** Only options meaningful for the field type survive; everything else is dropped. */
export function normalizeFieldOptions(type: FieldType, raw: unknown, existing: FieldOptions = {}): FieldOptions {
  const o = isObj(raw) ? raw : {};
  const out: FieldOptions = {};
  const help = str(o.help, 300);
  if (help) out.help = help;
  const placeholder = str(o.placeholder, 100);
  if (placeholder) out.placeholder = placeholder;
  if (o.unique === true && ["text", "email", "phone", "url", "number"].includes(type)) out.unique = true;

  switch (type) {
    case "number": {
      out.format = typeof o.format === "string" && FORMATS.has(o.format) ? (o.format as FieldOptions["format"]) : "integer";
      const precision = finiteNum(o.precision);
      if (precision !== undefined) out.precision = Math.min(8, Math.max(0, Math.round(precision)));
      if (finiteNum(o.min) !== undefined) out.min = finiteNum(o.min);
      if (finiteNum(o.max) !== undefined) out.max = finiteNum(o.max);
      break;
    }
    case "singleSelect":
    case "multiSelect":
      out.choices = normalizeChoices(o.choices);
      if (type === "multiSelect" && o.allowOther === true) out.allowOther = true;
      break;
    case "attachment":
      if (o.imagesOnly === true) out.imagesOnly = true;
      break;
    case "date":
      if (o.includeTime === true) out.includeTime = true;
      break;
    case "checkbox":
      if (o.icon === "flag") out.icon = "flag";
      break;
    case "link": {
      // The target table and its filter are fixed when the field is created.
      if (existing.linkTable) {
        out.linkTable = existing.linkTable;
        if (existing.linkFilter) out.linkFilter = existing.linkFilter;
        if (existing.legacyKey) out.legacyKey = existing.legacyKey;
      } else if (typeof o.linkTable === "string") out.linkTable = o.linkTable;
      out.multiple = existing.linkTable ? existing.multiple === true : o.multiple === true;
      break;
    }
    case "computed":
      if (existing.computed) out.computed = existing.computed;
      break;
    case "autonumber":
      if (existing.start !== undefined) out.start = existing.start;
      break;
    default:
      break;
  }
  return out;
}

export const isFieldType = (v: unknown): v is FieldType => typeof v === "string" && (FIELD_TYPES as readonly string[]).includes(v);
