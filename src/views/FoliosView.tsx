"use client";

import type { FieldDef } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import { Workspace } from "@/components/view/Workspace";
import type { FolioRow, RecordSet } from "@/types";
import { GroupLabel, orDash } from "./cells";
import styles from "./views.module.css";

const sidebar: SidebarConfig = {
  cta: "Create new folio",
  sections: [
    { id: "main", items: [{ id: "all", label: "Folios - All Active Categories", icon: "table", active: true }] },
    {
      id: "copy",
      label: "Copy Paste",
      collapsible: true,
      items: [
        { id: "gd", label: "Folios - Google Drives (Wo…", icon: "folder" },
        { id: "cat", label: "Folios - All by Category", icon: "folder" },
        { id: "star", label: "Folios - All by Category Star", icon: "folder" },
      ],
    },
    { id: "exceptions", label: "Exceptions", collapsible: true, items: [] },
    { id: "system", label: "System", collapsible: true, items: [] },
  ],
};

const fields: FieldDef[] = ["Folio", "Cord", "Inactive", "Group", "Category", "Active", "ASFS", "Actions"].map((name) => ({ name, kind: "text" }));

const theme: TableTheme = {
  border: "#1a2d50",
  headH: 35,
  headBorder: "#1a2d50",
  headBorderW: 2,
  rowH: 45,
  rowA: "#0f172a",
  rowB: "#0f172a",
  rowBorder: "#1a2d50",
  rowBorderW: 2,
  groupBg: "#0b1220",
  groupBorder: "#1a2d50",
  groupBorderW: 2,
  sumBg: "#0f172a",
  sumH: 28,
  addBg: "#0f172a",
  addBorder: "#0d2354",
  addBorderW: 1,
  radius: "8px 8px 0 0",
};

const dimCell = (v: string | number | null) => orDash(v, styles.muted);

// Widths from the measured header-text positions in Screens/05.
const columns: Column<FolioRow>[] = [
  { key: "folio", header: "Folio", width: 307, render: (r) => <span className={styles.strong}>{r.folio}</span> },
  { key: "cord", header: "Cord", width: 92, render: (r) => (r.cord ? <span className={styles.dimBlue}>{r.cord}</span> : dimCell(null)) },
  { key: "inactive", header: "Inactive", width: 92, render: (r) => dimCell(r.inactive) },
  { key: "group", header: "Group", width: 152, render: (r) => (r.group ? <span className={styles.dimBlue}>{r.group}</span> : dimCell(null)) },
  { key: "category", header: "Category", width: 162, render: (r) => (r.category ? <span className={styles.dimBlue}>{r.category}</span> : dimCell(null)) },
  { key: "active", header: "Active", width: 92, render: (r) => (r.active === null ? dimCell(null) : <span className={styles.muted}>{r.active}</span>) },
  { key: "asfs", header: "ASFS", width: 92, render: (r) => (r.asfs === null ? dimCell(null) : <span className={styles.muted}>{r.asfs}</span>) },
  { key: "actions", header: "Actions", width: 260, render: (r) => (r.actions ? <span className={styles.muted}>{r.actions}</span> : dimCell(null)) },
];

export function FoliosView({ data }: { data: RecordSet<FolioRow> }) {
  return (
    <Workspace<FolioRow>
      sidebar={sidebar}
      title="Folios - All Active Categories"
      toolbar={{ hide: { label: "Hide fields" }, filter: { label: "Filter" }, group: { label: "Grouped by 1 field", active: true } }}
      fields={fields}
      toolbarTop={69.5}
      tableGap={21.5}
      data={data}
      table={{
        columns,
        rowKey: (r) => r.id,
        rowLabel: (r) => r.folio,
        theme,
        renderGroupLabel: (g) => <GroupLabel label={g.label ?? ""} count={g.count} />,
        sumRow: {
          label: "Sum",
          labelColumn: "folio",
          render: (g, c) => (g.sums && c.key in g.sums ? g.sums[c.key] : null),
        },
        addRow: { tone: "red" },
      }}
    />
  );
}
