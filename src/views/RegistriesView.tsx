"use client";

import { AlignLeft, CalendarDays, FileText, Paperclip, Table2 } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { field, form, type FieldDef } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import { Workspace } from "@/components/view/Workspace";
import type { RecordSet, RegistryRow } from "@/types";
import { Dash } from "./cells";
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
        { id: "grid", label: "Grid view", icon: "star", active: true },
        { id: "kanban", label: "Kanban board", icon: "kanban" },
      ],
    },
  ],
};

const fields: FieldDef[] = [
  field("Name", "name", { form: form.text({ required: true, wide: true }) }),
  field("Attachments", "attachment"),
  field("Status", "status", { kind: "select", form: form.select(["Coming Due", "Current"], { required: true }) }),
  field("Expiry", "expiry", { type: "date", form: { input: "date", required: true } }),
  field("Notes", "notes", { form: form.area({ nullable: true }) }),
];

const theme: TableTheme = {
  border: "#0b132b",
  radius: "8px",
  headH: 36,
  headColor: "#6b8fad",
  rowH: 100,
  rowA: "#0b132b",
  rowB: "#060e1e",
  colBorder: "#132040",
  cbBorder: "#3a4f72",
  footH: 56,
};

const Th = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <span className={styles.thWithIcon}>
    {icon}
    {children}
  </span>
);
const ico = { size: 14, strokeWidth: 1.75 } as const;

// Widths from the measured header positions in Screens/16.
const columns: Column<RegistryRow>[] = [
  { key: "name", header: <Th icon={<AlignLeft {...ico} />}>Name</Th>, width: 279, padLeft: 12, render: (r) => <span className={styles.white} style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span> },
  {
    key: "attachment",
    header: <Th icon={<Paperclip {...ico} />}>Attachments</Th>,
    width: 162,
    padLeft: 25,
    headPadLeft: 14,
    render: (r) => (r.attachment ? <Image src={r.attachment} alt="" width={110} height={76} className={styles.thumb} style={{ width: 110, height: 76, borderRadius: 4 }} /> : <Dash />),
  },
  {
    key: "status",
    header: <Th icon={<Table2 {...ico} />}>Status</Th>,
    width: 140,
    padLeft: 10,
    render: (r) => <Badge tone={r.status === "Coming Due" ? "comingDue" : "current"}>{r.status}</Badge>,
  },
  { key: "expiry", header: <Th icon={<CalendarDays {...ico} />}>Expiry</Th>, width: 130, padLeft: 10, render: (r) => <span className={styles.white} style={{ fontWeight: 400 }}>{r.expiry}</span> },
  { key: "notes", header: <Th icon={<FileText {...ico} />}>Notes</Th>, width: 387, padLeft: 10, render: (r) => (r.notes ? <span className={styles.cGrey2}>{r.notes}</span> : null) },
];

export function RegistriesView({ data }: { data: RecordSet<RegistryRow> }) {
  return (
    <Workspace<RegistryRow>
      sidebar={sidebar}
      title="Grid view"
      toolbar={{ hide: { label: "Hide fields" }, filter: { label: "Filter" }, group: { label: "Grouped by 1 field", active: true } }}
      fields={fields}
      records={{ section: "registries", singular: "registry", plural: "registries", label: (r) => r.name, blank: () => ({ name: "", attachment: "", status: "Current", expiry: "", notes: null }) }}
      toolbarTop={71.5}
      tableGap={21.5}
      data={data}
      table={{
        columns,
        rowKey: (r) => r.id,
        rowLabel: (r) => r.name,
        theme,
        selection: { width: 40, padLeft: 12 },
      }}
      footer={{ placement: "inside", variant: "boxed" }}
    />
  );
}
