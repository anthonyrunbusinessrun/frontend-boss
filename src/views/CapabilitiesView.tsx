"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { field, form, type FieldDef } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import { Workspace } from "@/components/view/Workspace";
import type { CapabilityRow, RecordSet } from "@/types";
import { Dash, GroupLabel } from "./cells";
import styles from "./views.module.css";

const sidebar: SidebarConfig = {
  cta: "Create new item",
  ctaGlow: true,
  sections: [
    { id: "views", label: "Views & Directories", collapsible: true, items: [{ id: "all", label: "All Capabilities View", icon: "star", active: true }] },
    {
      id: "system",
      label: "System",
      collapsible: true,
      items: [
        { id: "ops", label: "Operations Log", icon: "folder" },
        { id: "fema", label: "FEMA Requirements", icon: "folder" },
        { id: "local", label: "Local Allocations", icon: "folder" },
      ],
    },
  ],
};

const fields: FieldDef[] = [
  field("Code", "code", { form: form.text({ required: true }) }),
  field("Title", "title", { form: form.text({ required: true }) }),
  field("Brief Overview", "overview", { form: form.area() }),
  field("Gallery", "gallery"),
  field("Notes", "notes", { form: form.area() }),
  field("Attachments", "attachment", { form: form.text({ hint: "File name, e.g. SOP-Meals-V4.pdf" }) }),
  field("Key Features", "features", { kind: "multi", type: "list", form: form.list({ placeholder: "Separate features with commas" }) }),
  field("Tagline", "tagline", { form: form.text({ wide: true }) }),
];

const theme: TableTheme = {
  border: "#0b1f3a",
  radius: "8px",
  headH: 50,
  headBorderW: 2,
  rowH: 61,
  rowPadY: 6,
  rowA: "#0a1628",
  rowB: "#060e1e",
  rowBorder: "#1e3a5f",
  rowBorderW: 1,
  groupBg: "#0b1220",
  groupH: 34,
  footH: 56,
};

// Widths from the measured header positions in Screens/14 (trailing columns are clipped in the design).
const columns: Column<CapabilityRow>[] = [
  { key: "code", header: "Code", width: 107, render: (r) => <span className={styles.link}>{r.code}</span> },
  { key: "title", header: "Title", width: 172, padLeft: 0, render: (r) => <span className={styles.strong}>{r.title}</span> },
  { key: "overview", header: "Brief Overview", width: 212, padLeft: 0, render: (r) => <span className={styles.dimBlue}>{r.overview}</span> },
  {
    key: "gallery",
    header: "Gallery",
    width: 82,
    padLeft: 0,
    render: (r) => (r.gallery ? <Image src={r.gallery} alt="" width={48} height={28} className={styles.thumb} style={{ borderRadius: 4, width: 48, height: 28 }} /> : <Dash />),
  },
  { key: "notes", header: "Notes", width: 152, padLeft: 0, render: (r) => <span className={styles.dimBlue}>{r.notes}</span> },
  { key: "attachment", header: "Attachments", width: 132, padLeft: 0, render: (r) => <Badge tone="chip" shape="mini">{r.attachment}</Badge> },
  {
    key: "features",
    header: "Key Features",
    width: 172,
    padLeft: 0,
    wrap: true,
    render: (r) => (
      <span className={`${styles.chips} ${styles.chipsTight}`}>
        {r.features.map((f) => (
          <Badge key={f} tone="chip" shape="mini">
            {f}
          </Badge>
        ))}
      </span>
    ),
  },
  { key: "tagline", header: "Tagline", width: 260, padLeft: 0, render: (r) => <span className={styles.dimBlue}>{r.tagline}</span> },
];

export function CapabilitiesView({ data }: { data: RecordSet<CapabilityRow> }) {
  return (
    <Workspace<CapabilityRow>
      sidebar={sidebar}
      title="All Capabilities View"
      toolbar={{ hide: { label: "Hide fields" }, filter: { label: "Filter" }, group: { label: "Grouped by 1 field", active: true } }}
      fields={fields}
      records={{ section: "capabilities", singular: "capability", plural: "capabilities", label: (r) => r.title, blank: () => ({ code: "", title: "", overview: "", gallery: "", notes: "", attachment: "", features: [], tagline: "" }) }}
      toolbarTop={61.5}
      tableGap={21.5}
      data={data}
      table={{
        columns,
        rowKey: (r) => r.id,
        rowLabel: (r) => r.title,
        theme,
        renderGroupLabel: (g) => <GroupLabel label={g.label ?? ""} count={g.count} tone="countRed" />,
      }}
    />
  );
}
