"use client";

import { Badge } from "@/components/ui/Badge";
import type { FieldDef } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import { Workspace } from "@/components/view/Workspace";
import type { FormRow, RecordSet } from "@/types";
import { GroupLabel } from "./cells";
import styles from "./views.module.css";

const sidebar: SidebarConfig = {
  cta: "Create new item",
  ctaGlow: true,
  sections: [
    { id: "group", label: "WSF's Group", collapsible: true, items: [{ id: "general", label: "WSF General Forms", icon: "star", active: true }] },
    { id: "system", label: "System", items: [{ id: "exceptions", label: "EXCEPTIONS", icon: "folder" }] },
  ],
};

const fields: FieldDef[] = ["#", "Code", "Type", "Slug", "Style", "Form Title", "Long Title", "Group", "Description", "Actions"].map((name) => ({ name, kind: "text" }));

const theme: TableTheme = {
  border: "#0b1f3a",
  radius: "8px",
  headH: 36,
  headBorder: "#1a3050",
  rowH: 44,
  rowA: "#060e1e",
  rowB: "#0a1628",
  rowBorder: "#132040",
  rowBorderW: 1,
  groupBg: "#0b1220",
  groupH: 34,
  groupBorder: "#132040",
  addBg: "#0a1628",
  addBorder: "#132040",
  footH: 56,
};

// Widths from the measured header positions in Screens/12.
const columns: Column<FormRow>[] = [
  { key: "n", header: "#", width: 57, render: (_r, { index }) => <span className={styles.rowNum} style={{ color: "#6b8fad" }}>{index + 1}</span> },
  { key: "code", header: "Code", width: 62, padLeft: 0, render: (r) => <span className={styles.link}>{r.code}</span> },
  { key: "type", header: "Type", width: 82, padLeft: 0, render: (r) => <span className={styles.dimBlue}>{r.type}</span> },
  { key: "slug", header: "Slug", width: 122, padLeft: 0, render: (r) => <span className={styles.cLight}>{r.slug}</span> },
  { key: "style", header: "Style", width: 92, padLeft: 0, render: (r) => <Badge tone="work" shape="tag">{r.style}</Badge> },
  { key: "title", header: "Form Title", width: 132, padLeft: 0, render: (r) => <span className={`${styles.cLight} ${styles.b6}`}>{r.title}</span> },
  { key: "longTitle", header: "Long Title", width: 192, padLeft: 0, render: (r) => <span className={styles.cLight}>{r.longTitle}</span> },
  { key: "group", header: "Group", width: 102, padLeft: 0, render: (r) => <Badge tone={r.group === "Buy" ? "buy" : "blanket"} shape="tag">{r.group}</Badge> },
  { key: "description", header: "Description", width: 187, padLeft: 0, render: (r) => <span className={styles.dimBlue} style={{ display: "block", maxWidth: 125, overflow: "hidden", textOverflow: "ellipsis" }}>{r.description}</span> },
  // The design draws the "Actions" header but no row icons on this screen.
  { key: "actions", header: "Actions", width: 110, padLeft: 0, render: () => null },
];

export function FormsView({ data }: { data: RecordSet<FormRow> }) {
  return (
    <Workspace<FormRow>
      sidebar={sidebar}
      title="WSF General Forms"
      toolbar={{ hide: { label: "Hide fields" }, filter: { label: "Filter" }, group: { label: "Grouped by 1 field", active: true } }}
      fields={fields}
      toolbarTop={65.5}
      tableGap={21.5}
      data={data}
      table={{
        columns,
        rowKey: (r) => r.id,
        rowLabel: (r) => r.title,
        theme,
        renderGroupLabel: (g) => <GroupLabel label={g.label ?? ""} count={g.count} tone="countRed" />,
        addRow: { tone: "red" },
      }}
    />
  );
}
