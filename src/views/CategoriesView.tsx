"use client";

import { Badge } from "@/components/ui/Badge";
import { RowActions } from "@/components/ui/RowActions";
import { field, form, type FieldDef } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import { Workspace } from "@/components/view/Workspace";
import type { CategoryRow, RecordSet } from "@/types";
import { GroupLabel, orDash } from "./cells";
import styles from "./views.module.css";

const sidebar: SidebarConfig = {
  cta: "Create new category",
  sections: [
    { id: "views", label: "Views & Directories", collapsible: true, items: [{ id: "fcvl", label: "Folio Category Value List", icon: "table", active: true }] },
    {
      id: "system",
      label: "System",
      collapsible: true,
      items: [
        { id: "schemes", label: "Category Schemes", icon: "folder" },
        { id: "log", label: "System Log", icon: "folder" },
        { id: "config", label: "Configuration", icon: "folder" },
      ],
    },
  ],
};

const fields: FieldDef[] = [
  field("Value Code/Title", "code", { form: form.text({ required: true }) }),
  field("Group", "group", { form: form.text({ required: true }) }),
  field("Level Two Value", "levelTwo", { form: form.text({ nullable: true }) }),
  field("Folios", "folios", { kind: "multi", type: "list", form: form.list({ placeholder: "Separate folios with commas" }) }),
];

const theme: TableTheme = {
  headH: 36,
  headBorderW: 2,
  rowH: 0,
  rowPadY: 11,
  rowA: "#0f172a",
  rowB: "#0f172a",
  rowBorder: "#1e3a5f",
  rowBorderW: 1,
  groupBg: "#0b1220",
  groupH: 34,
  addH: 34,
  radius: "8px 8px 0 0",
};

const columns: Column<CategoryRow>[] = [
  { key: "code", header: "Value Code/Title", width: 247, render: (r) => <span className={`${styles.cLight} ${styles.b6}`}>{r.code}</span> },
  { key: "group", header: "Group", width: 192, render: (r) => <span className={styles.dimBlue}>{r.group}</span> },
  { key: "levelTwo", header: "Level Two Value", width: 192, render: (r) => orDash(r.levelTwo, styles.linkSoft) },
  {
    key: "folios",
    header: "Folios",
    width: 427,
    wrap: true,
    render: (r) =>
      r.folios.length ? (
        <span className={styles.chips}>
          {r.folios.map((f) => (
            <Badge key={f} tone="chip" shape="chip">
              {f}
            </Badge>
          ))}
        </span>
      ) : (
        orDash(null)
      ),
  },
  { key: "actions", header: "Actions", width: 80, padLeft: 0, padRight: 0, render: (r) => <RowActions label={r.code} iconSize={16} /> },
];

export function CategoriesView({ data }: { data: RecordSet<CategoryRow> }) {
  return (
    <Workspace<CategoryRow>
      sidebar={sidebar}
      title="Folio Category Value List"
      toolbar={{ hide: { label: "Hide fields" }, filter: { label: "Filter" }, group: { label: "Grouped by 1 field", active: true } }}
      fields={fields}
      records={{ section: "categories", singular: "category", plural: "categories", label: (r) => r.code, blank: () => ({ code: "", group: "", levelTwo: null, folios: [] }) }}
      toolbarTop={72.5}
      tableGap={20.5}
      data={data}
      table={{
        columns,
        rowKey: (r) => r.id,
        rowLabel: (r) => r.code,
        theme,
        renderGroupLabel: (g) => <GroupLabel label={g.label ?? ""} count={g.count} />,
        addRow: { tone: "red" },
      }}
    />
  );
}
