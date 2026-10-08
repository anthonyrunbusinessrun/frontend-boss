"use client";

import { Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { RowActions } from "@/components/ui/RowActions";
import { field, form, type FieldDef } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import type { ToneName } from "@/lib/tones";
import { Workspace } from "@/components/view/Workspace";
import type { LeadRow, RecordSet } from "@/types";
import { Dash, GroupLabel } from "./cells";
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
        { id: "grid", label: "Grid View", icon: "star", active: true },
        { id: "pipelines", label: "All Active Pipelines", icon: "table" },
        { id: "archived", label: "Archived Enquiries", icon: "table" },
      ],
    },
    {
      id: "system",
      label: "System",
      collapsible: true,
      items: [
        { id: "assigned", label: "Assigned to Me", icon: "folder" },
        { id: "awaiting", label: "Awaiting FEMA Action", icon: "folder" },
        { id: "priority", label: "High Priority Alerts", icon: "folder" },
      ],
    },
    {
      id: "exceptions",
      label: "Exceptions",
      collapsible: true,
      items: [
        { id: "overdue", label: "Overdue Responses", icon: "table" },
        { id: "missing", label: "Missing Notice URLs", icon: "table" },
      ],
    },
  ],
};

const fields: FieldDef[] = [
  field("ID", "leadId", { column: "id", form: form.text({ required: true, placeholder: "e.g. L-4097" }) }),
  field("Client", "client", { form: form.text({ required: true }) }),
  field("Full Title", "title", { form: form.text({ required: true, wide: true }) }),
  field("Type", "type", { kind: "select", form: form.select(["Solicitation", "Sources Sought", "Combined Syn/Solicitation", "Request for Information"], { required: true }) }),
  field("Due (Local)", "due", { column: "due", form: form.text({ placeholder: "MM/DD/YYYY" }) }),
  field("Files", "hasFiles", { column: "files", kind: "checkbox", form: form.check({ hint: "Attachments were provided with the notice." }) }),
  field("Notice URL", "url", { column: "url", form: form.text({ wide: true }) }),
  { name: "Actions", kind: "text" },
];

const theme: TableTheme = {
  border: "#0d1830",
  radius: "8px",
  headH: 46,
  headBorder: "#0d1830",
  headBorderW: 2,
  rowH: 46,
  rowA: "#0a1628",
  rowB: "#060e1e",
  rowBorder: "#0d1830",
  rowBorderW: 2,
  groupBg: "#0b1220",
  groupH: 34,
  groupBorder: "#0d1830",
  groupBorderW: 2,
  chevColor: "#cf0e38",
  cbBorder: "#6b8fad",
  footH: 56,
};

const typeTone: Record<LeadRow["type"], ToneName> = {
  Solicitation: "solicitation",
  "Sources Sought": "sourcesSought",
  "Combined Syn/Solicitation": "combined",
  "Request for Information": "rfi",
};

// Widths from the measured header positions in Screens/15.
const columns: Column<LeadRow>[] = [
  { key: "id", header: "ID", width: 82, padLeft: 0, render: (r) => <span className={styles.b6} style={{ color: "#e53935" }}>{r.leadId}</span> },
  { key: "client", header: "Client", width: 122, padLeft: 0, render: (r) => <span className={`${styles.cLight} ${styles.b6}`}>{r.client}</span> },
  { key: "title", header: "Full Title", width: 150, padLeft: 0, render: (r) => <span className={styles.cLight}>{r.title}</span> },
  { key: "type", header: "Type", width: 192, padLeft: 0, render: (r) => <Badge tone={typeTone[r.type]} shape="outline">{r.type}</Badge> },
  { key: "due", header: "Due (Local)", width: 138, padLeft: 0, render: (r) => <span className={styles.secondary}>{r.due}</span> },
  { key: "files", header: "Files", width: 56, padLeft: 8, headPadLeft: 0, render: (r) => (r.hasFiles ? <Paperclip size={14} className={styles.secondary} aria-label="Has files" /> : <Dash />) },
  { key: "url", header: "Notice URL", width: 218, padLeft: 0, render: (r) => <span className={styles.dimBlue}>{r.url}</span> },
  { key: "actions", header: "Actions", width: 129, align: "center", render: (r) => <RowActions variant="boxed" label={r.leadId} iconSize={15} /> },
];

export function LeadsView({ data }: { data: RecordSet<LeadRow> }) {
  return (
    <Workspace<LeadRow>
      sidebar={sidebar}
      title="Grid View"
      toolbar={{ hide: { label: "Hide fields" }, filter: { label: "Filter" }, group: { label: "Grouped by 1 field", active: true } }}
      fields={fields}
      records={{ section: "leads", singular: "lead", plural: "leads", label: (r) => r.leadId, blank: () => ({ leadId: "", client: "", title: "", type: "Solicitation", due: "", hasFiles: false, url: "" }) }}
      toolbarTop={61.5}
      tableGap={21.5}
      data={data}
      table={{
        columns,
        rowKey: (r) => r.id,
        rowLabel: (r) => r.leadId,
        theme,
        selection: { width: 51, padLeft: 20 },
        renderGroupLabel: (g) => <GroupLabel label={g.label ?? ""} count={g.count} tone="countRed" />,
      }}
    />
  );
}
