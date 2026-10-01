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

export interface FieldDef {
  name: string;
  kind: FieldKind;
}

/**
 * Field list shown in the Sort / Hide-fields cards for Profiles. Taken from
 * Cards:Modals/action-sort-card.png and fields-hidden-manager-card.png.
 * NEEDS CLARIFICATION: the lists scroll past what the images show (the screen says "57 hidden fields").
 */
export const PROFILE_FIELDS: FieldDef[] = [
  { name: "Contact", kind: "formula" },
  { name: "Hard Code", kind: "text" },
  { name: "SMS Opt In", kind: "checkbox" },
  { name: "Sal", kind: "text" },
  { name: "Name", kind: "text" },
  { name: "Position", kind: "text" },
  { name: "Billing", kind: "multi" },
  { name: "Type", kind: "select" },
  { name: "eMail", kind: "email" },
  { name: "Address", kind: "text" },
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
