"use client";

import { CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { RowActions } from "@/components/ui/RowActions";
import type { FieldDef } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import { Workspace } from "@/components/view/Workspace";
import type { ActionRow, RecordSet } from "@/types";
import styles from "./views.module.css";

const sidebar: SidebarConfig = {
  // NEEDS CLARIFICATION: the design labels this button "Create new profile" on the Actions screen (likely a copy-paste slip).
  cta: "Create new profile",
  sections: [
    {
      id: "copy",
      label: "Copy Paste",
      collapsible: true,
      items: [
        { id: "eje", label: "EJE", icon: "star" },
        { id: "tickets", label: "Work Tickets", icon: "star" },
      ],
    },
    {
      id: "views",
      label: "Views & Directories",
      collapsible: true,
      items: [
        { id: "master", label: "Master List Active Actions", icon: "list" },
        { id: "open", label: "OPEN ACTIONS", icon: "list", count: 39 },
        { id: "byfolio", label: "BY FOLIO - HOT QA/NEXT", icon: "list", active: true },
        { id: "future", label: "OPEN ACTIONS - FUTURE", icon: "clock" },
        { id: "ray", label: "OPEN ACTIONS - RAY ONLY", icon: "lock" },
        { id: "new", label: "NEW OPEN ACTIONS", icon: "plusCircle" },
        { id: "templates", label: "Action Order - Templates", icon: "folder" },
        { id: "kanban", label: "Kanban view", icon: "table" },
      ],
    },
    {
      id: "collab",
      label: "Collaborative",
      collapsible: true,
      items: [
        { id: "blast", label: "Test Blast", icon: "send" },
        { id: "exceptions", label: "Exceptions", icon: "alert", count: 3 },
        { id: "system", label: "System view", icon: "settings" },
        { id: "abs", label: "ABS Registry", icon: "database" },
      ],
    },
  ],
};

const fields: FieldDef[] = ["Code", "Accrue", "Task Title", "Type", "Status", "Folio", "WK", "ACT", "QA"].map((name) => ({ name, kind: "text" }));

const theme: TableTheme = {
  border: "#151f35",
  headH: 35,
  headBorder: "#151f35",
  rowH: 40,
  rowA: "#0a1020",
  rowB: "#0d1526",
  rowBorder: "#151f35",
  rowBorderW: 1,
  radius: "8px 8px 0 0",
};

const typeTone = { Tasking: "tasking", Training: "training", Notice: "notice" } as const;
const statusTone = { Ongoing: "ongoing", Queue: "queue", Scheduled: "scheduled" } as const;

const Flag = ({ on, label }: { on: boolean; label: string }) =>
  on ? (
    <span className={styles.iconCheck} role="img" aria-label={`${label} complete`}>
      <CircleCheck size={15} strokeWidth={2} />
    </span>
  ) : (
    <span className={styles.iconDash} aria-label={`${label} incomplete`}>
      –
    </span>
  );

// Widths from the measured header-text positions in Screens/06.
const columns: Column<ActionRow>[] = [
  { key: "n", header: "#", width: 60, align: "center", padLeft: 0, render: (_r, { index }) => <span className={styles.rowNum}>{index + 1}</span> },
  { key: "code", header: "Code", width: 81, render: (r) => <span className={styles.strong}>{r.code}</span> },
  { key: "accrue", header: "Accrue", width: 98, render: (r) => <span className={styles.soft}>{r.accrue}</span> },
  { key: "title", header: "Task Title", width: 318, render: (r) => <span className={styles.title}>{r.title}</span> },
  { key: "type", header: "Type", width: 102, render: (r) => <Badge tone={typeTone[r.type]}>{r.type}</Badge> },
  { key: "status", header: "Status", width: 106, render: (r) => <Badge tone={statusTone[r.status]}>{r.status}</Badge> },
  { key: "folio", header: "Folio", width: 84, render: (r) => <span className={styles.soft}>{r.folio}</span> },
  { key: "wk", header: "WK", width: 66, align: "center", render: (r) => <span className={styles.soft}>{r.wk}</span> },
  { key: "act", header: "ACT", width: 67, align: "center", render: (r) => <Flag on={r.act} label="ACT" /> },
  { key: "qa", header: "QA", width: 58, align: "center", render: (r) => <Flag on={r.qa} label="QA" /> },
  { key: "actions", header: "Actions", width: 98, headPadLeft: 21, padLeft: 12.5, render: (r) => <RowActions label={r.code} /> },
];

export function ActionsView({ data }: { data: RecordSet<ActionRow> }) {
  return (
    <Workspace<ActionRow>
      sidebar={sidebar}
      title="BY FOLIO - HOT QA/NEXT"
      toolbar={{ hide: { label: "Hide fields" }, filter: { label: "Filter" }, group: { label: "Grouped by 1 field", active: true } }}
      fields={fields}
      toolbarTop={61.5}
      tableGap={21.5}
      data={data}
      table={{ columns, rowKey: (r) => r.id, rowLabel: (r) => r.code, theme }}
    />
  );
}
