import { isIsoDate } from "@/lib/dates";
import { toNumber } from "./compute";
import { isEditableType, readAttachments } from "./fields";
import { isBlank } from "./query";
import type { AttachmentValue, FieldDef } from "./types";

export type FieldErrors = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** http(s) URLs, site-relative paths, and bare hosts such as `fema.gov/lodging` (as already stored for Leads). */
export function isHttpUrl(v: string): boolean {
  if (/\s/.test(v)) return false;
  if (v.startsWith("/")) return !v.startsWith("//");
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }
  return /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(v);
}

export interface ValidateOptions {
  /** On update only the supplied keys are checked; on create every required field is. */
  mode: "create" | "update";
  /** Keys that count as required in addition to the field's own flag (form views). */
  requiredKeys?: ReadonlySet<string>;
  /** Only these keys may be written (form views expose a subset of fields). */
  allowedKeys?: ReadonlySet<string>;
}

export interface ValidateResult {
  values: Record<string, unknown>;
  errors: FieldErrors;
  /** Keys in the input that match no editable field. They are dropped, never stored. */
  ignored: string[];
}

/** Coerce and validate user input against the table's field definitions. Pure: no I/O. */
export function validateRecordInput(fields: FieldDef[], input: Record<string, unknown>, opts: ValidateOptions): ValidateResult {
  const values: Record<string, unknown> = {};
  const errors: FieldErrors = {};
  const ignored: string[] = [];
  const byKey = new Map(fields.map((f) => [f.key, f]));

  for (const key of Object.keys(input)) {
    if (key === "id") continue;
    const f = byKey.get(key);
    if (!f || !isEditableType(f.type) || (opts.allowedKeys && !opts.allowedKeys.has(key))) ignored.push(key);
  }

  for (const f of fields) {
    if (!isEditableType(f.type)) continue;
    if (opts.allowedKeys && !opts.allowedKeys.has(f.key)) continue;
    const supplied = Object.prototype.hasOwnProperty.call(input, f.key);
    const required = f.required || opts.requiredKeys?.has(f.key) === true;

    // Generated codes and system-managed files are never taken from the request body.
    if (f.options.sequence) {
      if (supplied && opts.mode === "update") errors[f.key] = `${f.name} is assigned automatically and cannot be changed.`;
      continue;
    }

    if (!supplied) {
      if (opts.mode === "create" && required && f.type !== "checkbox") errors[f.key] = requiredMessage(f);
      continue;
    }

    const result = coerce(f, input[f.key]);
    if (result.error) {
      errors[f.key] = result.error;
      continue;
    }
    if (required && f.type !== "checkbox" && isBlank(result.value)) {
      errors[f.key] = requiredMessage(f);
      continue;
    }
    values[f.key] = result.value;
  }
  return { values, errors, ignored };
}

const requiredMessage = (f: FieldDef) => (f.type === "singleSelect" || f.type === "link" ? `Choose a value for ${f.name}.` : `${f.name} is required.`);

function coerce(f: FieldDef, raw: unknown): { value: unknown; error?: string } {
  const empty = raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "");
  switch (f.type) {
    case "checkbox":
      return { value: raw === true || raw === "true" };
    case "text":
    case "longText":
    case "phone": {
      if (empty) return { value: null };
      if (typeof raw !== "string" && typeof raw !== "number") return { value: null, error: `${f.name} must be text.` };
      const s = String(raw).trim();
      if (s.length > (f.type === "longText" ? 20_000 : 2_000)) return { value: null, error: `${f.name} is too long.` };
      return { value: s };
    }
    case "email": {
      if (empty) return { value: null };
      const s = String(raw).trim();
      return EMAIL.test(s) ? { value: s } : { value: null, error: "Enter a valid email address." };
    }
    case "url": {
      if (empty) return { value: null };
      const s = String(raw).trim();
      return isHttpUrl(s) ? { value: s } : { value: null, error: "Enter a valid URL (https://…)." };
    }
    case "number": {
      if (empty) return { value: null };
      const n = toNumber(raw);
      if (n === null) return { value: null, error: "Enter a number." };
      const { min, max, format } = f.options;
      if (format === "integer" && !Number.isInteger(n)) return { value: null, error: "Enter a whole number." };
      if (min !== undefined && n < min) return { value: null, error: `Must be ${min} or more.` };
      if (max !== undefined && n > max) return { value: null, error: `Must be ${max} or less.` };
      return { value: n };
    }
    case "date": {
      if (empty) return { value: null };
      const s = String(raw).trim().slice(0, 10);
      return isIsoDate(s) ? { value: s } : { value: null, error: "Enter a valid date." };
    }
    case "singleSelect": {
      if (empty) return { value: null };
      const s = String(raw);
      const ok = f.options.choices?.some((c) => c.name === s);
      return ok ? { value: s } : { value: null, error: "Choose one of the listed options." };
    }
    case "multiSelect": {
      if (empty) return { value: [] };
      const list = Array.isArray(raw) ? raw : [raw];
      const names = [...new Set(list.map((x) => String(x).trim()).filter(Boolean))];
      if (!f.options.allowOther) {
        const known = new Set(f.options.choices?.map((c) => c.name));
        const bad = names.find((n) => !known.has(n));
        if (bad) return { value: null, error: `“${bad}” is not one of the listed options.` };
      }
      return { value: names };
    }
    case "link": {
      if (empty || (Array.isArray(raw) && raw.length === 0)) return { value: f.options.multiple ? [] : null };
      const ids = (Array.isArray(raw) ? raw : [raw]).map((x) => String(x));
      if (!f.options.multiple && ids.length > 1) return { value: null, error: `${f.name} accepts a single record.` };
      const unique = [...new Set(ids)];
      return { value: f.options.multiple ? unique : unique[0] };
    }
    case "attachment": {
      if (empty || (Array.isArray(raw) && raw.length === 0)) return { value: [] };
      const list = readAttachments(raw);
      if (list.length === 0) return { value: null, error: "Attachments are not valid." };
      const clean: AttachmentValue[] = [];
      for (const a of list) {
        if (!a.url.startsWith("/") || a.url.startsWith("//")) return { value: null, error: "Attachments must be uploaded files." };
        if (f.options.imagesOnly && a.type && !a.type.startsWith("image/")) return { value: null, error: "Only images are allowed in this field." };
        clean.push({ id: a.id, name: a.name.slice(0, 200), url: a.url, type: a.type, size: a.size });
      }
      return { value: clean };
    }
    default:
      return { value: raw };
  }
}

export const hasErrors = (e: FieldErrors) => Object.keys(e).length > 0;
