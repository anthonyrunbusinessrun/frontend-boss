import type { FieldDef } from "@/components/popovers/fields";

/* Pure helpers behind the generic record form: row <-> form values, validation. */

export type FormValues = Record<string, string | boolean>;
export type FormErrors = Record<string, string>;

/** Fields the form can edit: they name a row property and declare a form control. */
export function editableFields(fields: FieldDef[]): FieldDef[] {
  return fields.filter((f) => f.key !== undefined && f.form !== undefined);
}

export function toFormValues(row: Record<string, unknown> | null, fields: FieldDef[]): FormValues {
  const values: FormValues = {};
  for (const f of editableFields(fields)) {
    const raw = row ? row[f.key!] : undefined;
    switch (f.form!.input) {
      case "checkbox":
        values[f.key!] = Boolean(raw);
        break;
      case "list":
        values[f.key!] = Array.isArray(raw) ? raw.join(", ") : "";
        break;
      case "select":
        values[f.key!] = raw === null || raw === undefined || raw === "" ? (row ? "" : (f.form!.options?.[0] ?? "")) : String(raw);
        break;
      default:
        values[f.key!] = raw === null || raw === undefined ? "" : String(raw);
    }
  }
  return values;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isUrl(v: string): boolean {
  if (v.startsWith("/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateForm(values: FormValues, fields: FieldDef[]): FormErrors {
  const errors: FormErrors = {};
  for (const f of editableFields(fields)) {
    const cfg = f.form!;
    const key = f.key!;
    const v = values[key];
    const text = typeof v === "string" ? v.trim() : "";
    if (cfg.input === "checkbox") continue;
    if (cfg.required && text === "") {
      errors[key] = cfg.input === "select" ? `Choose a ${f.name.toLowerCase()}.` : `${f.name} is required.`;
      continue;
    }
    if (text === "") continue;
    if (cfg.input === "email" && !EMAIL.test(text)) errors[key] = "Enter a valid email address.";
    else if (cfg.input === "url" && !isUrl(text)) errors[key] = "Enter a valid URL (https://…).";
    else if (cfg.input === "number") {
      const n = Number(text);
      if (!Number.isFinite(n)) errors[key] = "Enter a number.";
      else if (cfg.min !== undefined && n < cfg.min) errors[key] = `Must be ${cfg.min} or more.`;
    } else if (cfg.input === "select" && cfg.options && !cfg.options.includes(text)) errors[key] = "Choose one of the listed options.";
  }
  return errors;
}

/** Convert validated form values back to row properties. */
export function fromFormValues(values: FormValues, fields: FieldDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of editableFields(fields)) {
    const cfg = f.form!;
    const key = f.key!;
    const v = values[key];
    switch (cfg.input) {
      case "checkbox":
        out[key] = Boolean(v);
        break;
      case "number": {
        const t = String(v ?? "").trim();
        out[key] = t === "" ? (cfg.nullable ? null : 0) : Number(t);
        break;
      }
      case "list":
        out[key] = String(v ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        break;
      default: {
        const t = String(v ?? "").trim();
        out[key] = t === "" && cfg.nullable ? null : t;
      }
    }
  }
  return out;
}

export function formatForDisplay(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export function isDirty(a: FormValues, b: FormValues): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (a[k] !== b[k]) return true;
  return false;
}
