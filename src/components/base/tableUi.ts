import type { FieldType } from "@/lib/base/types";

/**
 * Per-table presentation: which contextual buttons sit at the right of the content header, and any
 * extras (area tabs, side panels). Everything else is shared by all tables.
 */
export interface HeaderAction {
  id: string;
  label: string;
  /** "create" opens the record form; the others open the matching modal or panel. */
  kind: "create" | "adjustStock" | "voucherTools";
  primary?: boolean;
  preset?: Record<string, unknown>;
  fieldKeys?: string[];
  title?: string;
}

export interface AreaTab {
  label: string;
  /** `config.key` of the view this tab opens. */
  viewKey: string;
  /** Records counted on the tab. */
  count: (r: Record<string, unknown>) => boolean;
  description: string;
}

export interface TableUi {
  actions: HeaderAction[];
  areas?: AreaTab[];
  panel?: "voucher";
  subtitle?: string;
}

const create = (singular: string): HeaderAction => ({ id: "create", label: `New ${singular}`, kind: "create", primary: true });

/** The Team Profile form: the people-directory fields of the Team Profiles view. */
export const TEAM_FIELDS = ["photo", "contact", "name", "sal", "position", "type", "billing", "email", "phone1", "phone1Title", "phone2", "phone2Title", "address", "hardCode", "smsOptIn", "team", "bio"];

export const TABLE_UI: Record<string, TableUi> = {
  profiles: {
    subtitle: "People and organizations. Team members can be assigned to folios.",
    actions: [{ id: "team", label: "Add team member", kind: "create", primary: true, preset: { team: true, inactive: false }, fieldKeys: TEAM_FIELDS, title: "New team member" }, { id: "create", label: "New profile", kind: "create" }],
  },
  categories: { actions: [create("category")], subtitle: "Categories group folios. New categories appear in the Folio category list automatically." },
  folios: { actions: [create("folio")] },
  actions: { actions: [create("action")] },
  vouchers: { actions: [create("voucher"), { id: "tools", label: "Voucher tools", kind: "voucherTools" }], panel: "voucher" },
  transactions: { actions: [create("transaction")] },
  items: { actions: [create("item"), { id: "stock", label: "Adjust stock", kind: "adjustStock" }], subtitle: "Inventory: quantities, units and stock status." },
  forms: { actions: [create("form")] },
  concepts: { actions: [create("concept")] },
  capabilities: {
    actions: [create("capability")],
    areas: [
      { label: "System", viewKey: "system", count: (r) => r.area === "System", description: "Capabilities marked System" },
      { label: "Exception", viewKey: "exceptions", count: (r) => r.area === "Exception", description: "Capabilities marked Exception" },
      { label: "All", viewKey: "all", count: () => true, description: "Every capability" },
    ],
  },
  leads: { actions: [create("lead")] },
};

export const addFieldTypes: FieldType[] = ["text", "number", "date", "singleSelect"];
