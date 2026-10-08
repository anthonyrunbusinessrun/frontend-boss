import {
  CircleChevronDown,
  List,
  Mail,
  Phone,
  SquareCheck,
  SquareFunction,
  Table2,
  Type,
  ChevronDown,
  SlidersVertical,
} from "lucide-react";
import type { ReactNode } from "react";

export type FieldKind = "formula" | "text" | "checkbox" | "multi" | "select" | "email" | "phone" | "table";

/** How a field's value is compared when sorting / filtering. */
export type FieldValueType = "text" | "number" | "boolean" | "list" | "date";

/** Input control used for the field in the record form. */
export type FormInput = "text" | "textarea" | "number" | "select" | "checkbox" | "email" | "url" | "list" | "date";

export interface FieldFormConfig {
  input: FormInput;
  required?: boolean;
  options?: readonly string[];
  placeholder?: string;
  hint?: string;
  /** An empty input is saved as `null` (for `string | null` row properties). */
  nullable?: boolean;
  /** Spans both columns of the form grid. */
  wide?: boolean;
  min?: number;
}

/**
 * One field of a view. It drives the Sort / Hide-fields / Filter cards, the
 * header search and the record form. A field without a `key` is display-only:
 * it appears in the cards (as drawn in the designs) but cannot be evaluated.
 */
export interface FieldDef {
  name: string;
  kind: FieldKind;
  /** Row property this field reads. */
  key?: string;
  /** Column key that "Hide fields" toggles (defaults to `key`). */
  column?: string;
  type?: FieldValueType;
  /** Computed accessor; overrides `key`. */
  get?: (row: never) => unknown;
  /** Present when the field can be edited in the record form. */
  form?: FieldFormConfig;
}

/** Shorthand for the form control of a field. */
export const form = {
  text: (o: Partial<FieldFormConfig> = {}): FieldFormConfig => ({ input: "text", ...o }),
  area: (o: Partial<FieldFormConfig> = {}): FieldFormConfig => ({ input: "textarea", wide: true, ...o }),
  number: (o: Partial<FieldFormConfig> = {}): FieldFormConfig => ({ input: "number", ...o }),
  select: (options: readonly string[], o: Partial<FieldFormConfig> = {}): FieldFormConfig => ({ input: "select", options, ...o }),
  check: (o: Partial<FieldFormConfig> = {}): FieldFormConfig => ({ input: "checkbox", ...o }),
  list: (o: Partial<FieldFormConfig> = {}): FieldFormConfig => ({ input: "list", wide: true, ...o }),
  url: (o: Partial<FieldFormConfig> = {}): FieldFormConfig => ({ input: "url", ...o }),
  email: (o: Partial<FieldFormConfig> = {}): FieldFormConfig => ({ input: "email", ...o }),
};

/** Compact constructor for a field backed by a row property. */
export function field(name: string, key: string, extra: Partial<Omit<FieldDef, "name" | "key">> = {}): FieldDef {
  return { name, kind: "text", key, column: key, ...extra };
}

/**
 * Field list shown in the Sort / Hide-fields cards for Profiles. Taken from
 * Cards:Modals/action-sort-card.png and fields-hidden-manager-card.png.
 * NEEDS CLARIFICATION: the lists scroll past what the images show (the screen says "57 hidden fields").
 */
export const PROFILE_FIELDS: FieldDef[] = [
  { name: "Contact", kind: "formula", key: "contact", column: "contact", form: form.text({ required: true, placeholder: "e.g. RL3" }) },
  { name: "Hard Code", kind: "text" },
  { name: "SMS Opt In", kind: "checkbox" },
  { name: "Sal", kind: "text", key: "sal", column: "sal", form: form.select(["Mr.", "Ms.", "Mrs.", "Dr."], { nullable: true }) },
  { name: "Name", kind: "text", key: "name", column: "name", form: form.text({ required: true }) },
  { name: "Position", kind: "text", key: "position", column: "position", form: form.text({ required: true }) },
  { name: "Billing", kind: "multi", key: "billing", column: "billing", form: form.select(["LLG", "BOSS"], { nullable: true }) },
  { name: "Type", kind: "select", key: "type", column: "type", form: form.select(["Agent", "Rep"], { required: true }) },
  { name: "eMail", kind: "email", key: "email", column: "email", form: form.email({ required: true }) },
  { name: "Address", kind: "text", key: "address", column: "address", form: form.text({ nullable: true, wide: true }) },
  { name: "Phone 1", kind: "phone" },
  { name: "Team", kind: "checkbox" },
  { name: "P1 Tlt", kind: "text" },
  { name: "Phone 2", kind: "phone" },
  { name: "P2 Tlt", kind: "text" },
  { name: "Phone 3", kind: "phone" },
  { name: "P3 Tlt", kind: "text" },
  { name: "Inactive", kind: "checkbox" },
];

/** Outline field-type icons (design-system §6.12). `style` picks the Sort or Hide-fields icon set. */
export function FieldIcon({ kind, style = "sort", size = 18 }: { kind: FieldKind; style?: "sort" | "manager"; size?: number }): ReactNode {
  const p = { size, strokeWidth: 1.75 } as const;
  switch (kind) {
    case "formula":
      return style === "sort" ? <SquareFunction {...p} /> : <List {...p} />;
    case "checkbox":
      return <SquareCheck {...p} />;
    case "multi":
      return style === "sort" ? <SlidersVertical {...p} /> : <Table2 {...p} />;
    case "select":
      return style === "sort" ? <ChevronDown {...p} /> : <CircleChevronDown {...p} />;
    case "email":
      return <Mail {...p} />;
    case "phone":
      return <Phone {...p} />;
    case "table":
      return <Table2 {...p} />;
    case "text":
    default:
      return style === "sort" ? <Type {...p} /> : <List {...p} />;
  }
}
