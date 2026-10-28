import type { AttachmentValue, Choice, ChoiceColor, FieldDef, FieldOptions, FieldType } from "./types";
import { CHOICE_COLORS } from "./types";

/** Chip colours tuned for the BOSS dark surfaces (backgrounds are deep, text is light). */
export const CHOICE_TONES: Record<ChoiceColor, { bg: string; fg: string; border: string }> = {
  blue: { bg: "#10305c", fg: "#9cc7ff", border: "#1d4f93" },
  cyan: { bg: "#08404b", fg: "#7be9f5", border: "#0e6b7b" },
  green: { bg: "#0f3d2a", fg: "#74e0a5", border: "#1a6a49" },
  yellow: { bg: "#453a0b", fg: "#f4d96a", border: "#7a6613" },
  orange: { bg: "#4b2509", fg: "#ffb26b", border: "#8a4510" },
  red: { bg: "#4d0f1f", fg: "#ff8ea3", border: "#8c1a35" },
  pink: { bg: "#4a1240", fg: "#ff9be3", border: "#80206f" },
  purple: { bg: "#2f1f66", fg: "#c4b0ff", border: "#4f35a6" },
  gray: { bg: "#273448", fg: "#c3cedd", border: "#3d4d66" },
};

export interface FieldTypeInfo {
  type: FieldType;
  label: string;
  description: string;
  /** Creatable from the "Add field" menu. */
  creatable: boolean;
  /** Value can be edited by a person (computed and autonumber cannot). */
  editable: boolean;
}

export const FIELD_TYPE_INFO: FieldTypeInfo[] = [
  { type: "text", label: "Single line text", description: "A short piece of text", creatable: true, editable: true },
  { type: "longText", label: "Long text", description: "Notes and descriptions over several lines", creatable: true, editable: true },
  { type: "number", label: "Number", description: "Whole numbers, decimals, currency or percent", creatable: true, editable: true },
  { type: "date", label: "Date", description: "A calendar date", creatable: true, editable: true },
  { type: "checkbox", label: "Checkbox", description: "Yes / no", creatable: true, editable: true },
  { type: "singleSelect", label: "Single select", description: "Pick one option", creatable: true, editable: true },
  { type: "multiSelect", label: "Multiple select", description: "Pick several options", creatable: true, editable: true },
  { type: "attachment", label: "Attachment", description: "Images and files", creatable: true, editable: true },
  { type: "url", label: "URL", description: "A web address", creatable: true, editable: true },
  { type: "email", label: "Email", description: "An email address", creatable: true, editable: true },
  { type: "phone", label: "Phone", description: "A phone number", creatable: true, editable: true },
  { type: "link", label: "Link to another record", description: "Connect records from another table", creatable: true, editable: true },
  { type: "autonumber", label: "Autonumber", description: "A number assigned automatically", creatable: false, editable: false },
  { type: "computed", label: "Computed", description: "Calculated from other fields", creatable: false, editable: false },
];

export const fieldTypeLabel = (type: FieldType) => FIELD_TYPE_INFO.find((t) => t.type === type)?.label ?? type;
export const isEditableType = (type: FieldType) => FIELD_TYPE_INFO.find((t) => t.type === type)?.editable ?? true;

/**
 * Whether a person can type into the field in the generic record form or a grid cell.
 * Generated sequence codes, computed fields and autonumbers never can.
 */
export function isUserEditable(field: FieldDef, _mode: "create" | "update"): boolean {
  return isEditableType(field.type) && !field.options.sequence;
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14).padEnd(12, "0");
  return `${prefix}_${rand}`;
}

export const newFieldKey = () => newId("fld");

/** Build a choice list from plain names, cycling through the palette. */
export function choicesFromNames(names: readonly string[], colors?: readonly ChoiceColor[]): Choice[] {
  return names.map((name, i) => ({
    id: `ch_${slug(name) || i}`,
    name,
    color: colors?.[i] ?? CHOICE_COLORS[i % CHOICE_COLORS.length],
  }));
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function defaultOptions(type: FieldType): FieldOptions {
  switch (type) {
    case "number":
      return { format: "integer", precision: 0 };
    case "singleSelect":
    case "multiSelect":
      return { choices: [] };
    case "attachment":
      return {};
    case "link":
      return { multiple: false };
    default:
      return {};
  }
}

export function choiceByName(field: FieldDef, name: unknown): Choice | undefined {
  if (typeof name !== "string") return undefined;
  return field.options.choices?.find((c) => c.name === name);
}

/** Colour for a value that is not one of the configured choices (free tags). */
export function fallbackColor(name: string): ChoiceColor {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CHOICE_COLORS[h % CHOICE_COLORS.length];
}

/** Attachments are stored as arrays; older records hold a bare URL string. Both read the same. */
export function readAttachments(value: unknown): AttachmentValue[] {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") {
    const name = value.split("/").pop() || value;
    return [{ id: "", name, url: value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((v): AttachmentValue[] => {
      if (typeof v === "string") return readAttachments(v);
      if (v && typeof v === "object" && typeof (v as AttachmentValue).url === "string") {
        const a = v as AttachmentValue;
        return [{ id: a.id ?? "", name: a.name ?? a.url, url: a.url, type: a.type, size: a.size }];
      }
      return [];
    });
  }
  return [];
}

export const isImageAttachment = (a: AttachmentValue) => (a.type ? a.type.startsWith("image/") : /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(a.url) || /\.(png|jpe?g|gif|webp|avif)$/i.test(a.name));

export function fieldByKey(fields: FieldDef[]): Map<string, FieldDef> {
  return new Map(fields.map((f) => [f.key, f]));
}

export function primaryField(fields: FieldDef[]): FieldDef | undefined {
  return fields.find((f) => f.primary) ?? fields[0];
}
