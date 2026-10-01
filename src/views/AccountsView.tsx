"use client";

import { RowActions } from "@/components/ui/RowActions";
import type { FieldDef } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import { Workspace } from "@/components/view/Workspace";
import type { AccountRow, RecordSet } from "@/types";
import { GroupLabel, usd } from "./cells";
import styles from "./views.module.css";

const sidebar: SidebarConfig = {
  cta: "Create new item",
  ctaGlow: true,
  sections: [
    {
      id: "views",
      label: "Views & Directories",
      collapsible: true,
      items: [
        { id: "all", label: "All Accounts View", icon: "star", active: true },
        { id: "chart", label: "Chart of Accounts", icon: "folder" },
      ],
    },
    {
      id: "system",
      label: "System",
      collapsible: true,
      items: [
        { id: "schemes", label: "Category Schemes", icon: "database" },
        { id: "config", label: "Configuration", icon: "settings" },
      ],
    },
  ],
};

const fields: FieldDef[] = ["#", "Acct Code", "Title", "Acct Type", "Def", "Stmt", "Debits", "Credits", "Balance", "Transactions", "Frequent"].map((name) => ({ name, kind: "text" }));

const theme: TableTheme = {
  border: "#1e3a6e",
  radius: "8px",
  headH: 36,
  headBorder: "#1e3a6e",
  headBorderW: 2,
  rowH: 54,
  rowA: "#0f172a",
  rowB: "#0f172a",
  groupBg: "#0b1220",
  groupH: 34,
  groupBorder: "#1e3a6e",
  addBg: "#0f172a",
  cbBorder: "#2952a3",
  footH: 56,
};

// Widths from the measured header positions in Screens/11.
// NEEDS CLARIFICATION: the design wraps "$152,430.00" into two lines (a flaw); here the column is wide enough to keep it on one line.
const columns: Column<AccountRow>[] = [
  { key: "n", header: "#", width: 50, padLeft: 8, render: (_r, { index }) => <span className={styles.rowNum} style={{ color: "#64748b" }}>{index + 1}</span> },
  { key: "code", header: "Acct Code", width: 91, padLeft: 0, render: (r) => <span className={styles.link}>{r.code}</span> },
  { key: "title", header: "Title", width: 128, padLeft: 0, render: (r) => <span className={`${styles.cLight} ${styles.b6}`}>{r.title}</span> },
  { key: "type", header: "Acct Type", width: 92, padLeft: 0, render: (r) => <span className={styles.cPale}>{r.type}</span> },
  { key: "def", header: "Def", width: 72, padLeft: 0, render: (r) => <span className={styles.cPale}>{r.def}</span> },
  { key: "stmt", header: "Stmt", width: 96, padLeft: 0, wrap: true, render: (r) => <span className={styles.cPale}>{r.stmt}</span> },
  { key: "debits", header: "Debits", width: 111, align: "right", render: (r) => <span className={r.debits === 0 ? styles.muted : styles.cPale}>{usd(r.debits)}</span> },
  { key: "credits", header: "Credits", width: 112, align: "right", render: (r) => <span className={r.credits === 0 ? styles.muted : styles.cPale}>{usd(r.credits)}</span> },
  { key: "balance", header: "Balance", width: 96, align: "right", render: (r) => <span className={styles.b6} style={{ color: r.type === "Revenue" ? "#2e7d32" : "#c62828" }}>{usd(r.balance)}</span> },
  { key: "transactions", header: "Transactions", width: 78, align: "right", render: (r) => <span className={styles.cPale}>{r.transactions}</span> },
  { key: "frequent", header: "Frequent", width: 78, padLeft: 12, render: (r) => <span className={styles.cPale}>{r.frequent}</span> },
  { key: "actions", header: "Actions", width: 89, padLeft: 4, render: (r) => <RowActions label={r.title} iconSize={15} /> },
];

export function AccountsView({ data }: { data: RecordSet<AccountRow> }) {
  return (
    <Workspace<AccountRow>
      sidebar={sidebar}
      title="All Accounts View"
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
        selection: { width: 45, padLeft: 20 },
        renderGroupLabel: (g) => <GroupLabel label={g.label ?? ""} count={g.count} tone="countBlue" />,
        // The design draws "Add row" only under the last group.
        addRow: { tone: "red", show: (_g, i) => i === 1 },
      }}
      footer={{ placement: "inside", variant: "boxed" }}
    />
  );
}
