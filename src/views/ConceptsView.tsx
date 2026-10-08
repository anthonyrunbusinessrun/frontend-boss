"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { RowActions } from "@/components/ui/RowActions";
import { field, form, type FieldDef } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import { Workspace } from "@/components/view/Workspace";
import type { ConceptRow, RecordSet } from "@/types";
import { GroupLabel, orDash } from "./cells";
import styles from "./views.module.css";

const sidebar: SidebarConfig = {
  cta: "Create new item",
  ctaGlow: true,
  sections: [
    { id: "views", label: "Views & Shortcuts", collapsible: true, items: [{ id: "fcvl", label: "Folio Concepts Value List", icon: "star", active: true }] },
    {
      id: "system",
      label: "System",
      collapsible: true,
      items: [
        { id: "schema", label: "Category Schema", icon: "folder" },
        { id: "log", label: "System Log", icon: "folder" },
        { id: "config", label: "Configuration", icon: "folder" },
      ],
    },
  ],
};

const fields: FieldDef[] = [
  { name: "#", kind: "text" },
  field("Full Title", "title", { form: form.text({ required: true, wide: true }) }),
  field("Release", "release", { form: form.text({ nullable: true }) }),
  field("Acronym", "acronym", { form: form.text({ nullable: true }) }),
  field("Type", "type", { kind: "select", form: form.select(["Course"], { required: true }) }),
  field("Definition", "definition", { form: form.area({ nullable: true }) }),
  field("Related", "related", { form: form.text({ nullable: true }) }),
  field("Link", "link", { form: form.text() }),
  field("Work", "work", { kind: "multi", type: "list", form: form.list() }),
];

const theme: TableTheme = {
  border: "#0b1f3a",
  radius: "8px",
  headH: 36,
  headBorder: "#1a3355",
  headBorderW: 2,
  rowH: 43,
  rowPadY: 8,
  rowA: "#0a1628",
  rowB: "#060e1e",
  rowBorder: "#1a3355",
  rowBorderW: 1,
  groupBg: "#0b1220",
  groupH: 34,
  groupBorder: "#1a3355",
  cbBorder: "#1e3b70",
};

// Widths from the measured header positions in Screens/13.
const columns: Column<ConceptRow>[] = [
  { key: "n", header: "#", width: 52, padLeft: 0, render: (_r, { index }) => <span className={styles.rowNum} style={{ color: "#6b8fad" }}>{index + 1}</span> },
  { key: "title", header: "Full Title", width: 232, padLeft: 0, render: (r) => <span className={`${styles.cLight} ${styles.b6}`}>{r.title}</span> },
  { key: "release", header: "Release", width: 82, padLeft: 0, render: (r) => orDash(r.release && <span className={styles.dimBlue}>{r.release}</span>, styles.dimBlue) },
  { key: "acronym", header: "Acronym", width: 92, padLeft: 0, render: (r) => orDash(r.acronym && <span className={`${styles.cAcr} ${styles.b6}`}>{r.acronym}</span>, styles.dimBlue) },
  { key: "type", header: "Type", width: 92, padLeft: 0, render: (r) => <Badge tone="course">{r.type}</Badge> },
  { key: "definition", header: "Definition", width: 212, padLeft: 0, render: (r) => orDash(r.definition, styles.dimBlue) },
  { key: "related", header: "Related", width: 92, padLeft: 0, render: (r) => orDash(r.related, styles.dimBlue) },
  { key: "link", header: "Link", width: 112, padLeft: 0, render: (r) => <Badge tone="xmind">{r.link}</Badge> },
  {
    key: "work",
    header: "Work",
    width: 70,
    padLeft: 0,
    wrap: true,
    render: (r) =>
      r.work.length ? (
        <span className={styles.chips} style={{ flexDirection: "column", alignItems: "flex-start" }}>
          {r.work.map((w) => (
            <Badge key={w} tone="workRef" shape="mini">
              {w}
            </Badge>
          ))}
        </span>
      ) : null,
  },
  { key: "edit", header: <Plus size={14} aria-label="Add field" />, width: 51, padLeft: 8, render: (r) => <RowActions icons={["edit"]} label={r.title} iconSize={15} color="#6b8fad" /> },
];

export function ConceptsView({ data }: { data: RecordSet<ConceptRow> }) {
  return (
    <Workspace<ConceptRow>
      sidebar={sidebar}
      title="Folio Concepts Value List"
      toolbar={{ hide: { label: "Hide fields" }, filter: { label: "Filter" }, group: { label: "Grouped by 1 field", active: true } }}
      fields={fields}
      records={{ section: "concepts", singular: "concept", plural: "concepts", label: (r) => r.title, blank: () => ({ title: "", release: null, acronym: null, type: "Course", definition: null, related: null, link: "", work: [] }) }}
      toolbarTop={61.5}
      tableGap={21.5}
      data={data}
      table={{
        columns,
        rowKey: (r) => r.id,
        rowLabel: (r) => r.title,
        theme,
        selection: { width: 51, padLeft: 20 },
        renderGroupLabel: (g) => <GroupLabel label={g.label ?? ""} count={g.count} tone="countRed" />,
      }}
    />
  );
}
