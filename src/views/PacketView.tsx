"use client";

import { CornerDownRight, CircleHelp, FolderClosed, KeyRound, Link2, Tag, Type } from "lucide-react";
import type { FieldDef } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import { Workspace } from "@/components/view/Workspace";
import type { PacketRow, RecordSet } from "@/types";
import { GroupLabel, orDash } from "./cells";
import styles from "./views.module.css";

const sidebar: SidebarConfig = {
  cta: "Create new view",
  sections: [
    { id: "projects", label: "Project Packets", items: [{ id: "lw", label: "LandWatermelon.com", icon: "table" }] },
    {
      id: "collab",
      label: "Collaborative Views",
      items: [
        { id: "system", label: "SYSTEM", icon: "settings", active: true },
        { id: "upload", label: "Packet Upload Form", icon: "file" },
      ],
    },
  ],
};

const fields: FieldDef[] = ["Title", "Folder", "Record ID", "Folio", "URL", "Is Folder", "Parent Folder"].map((name) => ({ name, kind: "text" }));

const theme: TableTheme = {
  border: "#0b1f3a",
  headH: 31,
  headBorder: "#1e2d52",
  rowH: 35,
  rowA: "#0f172a",
  rowB: "#0f172a",
  rowBorder: "#1a2440",
  rowBorderW: 1,
  groupBg: "#0b1220",
  groupH: 32,
  groupBorder: "#1e2d52",
  addBg: "#0f172a",
  addBorder: "#1a2440",
  colBorder: "#1e2d52",
  groupSize: 13,
  groupWeight: 600,
  headTransform: "none",
  headLetterSpacing: "0",
  headSize: 12,
  headWeight: 500,
  cbBorder: "#64748b",
  radius: "8px 8px 0 0",
};

const Th = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <span className={styles.thWithIcon}>
    {icon}
    {children}
  </span>
);
const ico = { size: 14, strokeWidth: 1.75 } as const;

// Widths from the measured header positions in Screens/07 (first column holds checkbox + row number).
const columns: Column<PacketRow>[] = [
  { key: "title", header: <Th icon={<Type {...ico} />}>Title</Th>, width: 199, padLeft: 0, render: (r) => <span className={styles.cPackets}>{r.title}</span> },
  { key: "folder", header: <Th icon={<FolderClosed {...ico} />}>Folder</Th>, width: 90, padLeft: 0, render: (r) => <span className={styles.secondary}>{r.folder ?? "(Empty)"}</span> },
  { key: "recordId", header: <Th icon={<KeyRound {...ico} />}>Record ID</Th>, width: 160, padLeft: 0, render: (r) => <span className={`${styles.mono} ${styles.secondary}`}>{r.recordId}</span> },
  { key: "folio", header: <Th icon={<Tag {...ico} />}>Folio</Th>, width: 170, padLeft: 0, render: (r) => <span className={styles.cPackets}>{r.folio}</span> },
  { key: "url", header: <Th icon={<Link2 {...ico} />}>URL</Th>, width: 230, padLeft: 0, render: (r) => (r.url ? <span className={styles.linkSoft}>{r.url}</span> : <span className={styles.secondary}>—</span>) },
  { key: "isFolder", header: <Th icon={<CircleHelp {...ico} />}>Is Folder</Th>, width: 81, padLeft: 0, render: (r) => <span className={styles.secondary}>{r.isFolder ? "True" : "False"}</span> },
  { key: "parent", header: <Th icon={<CornerDownRight {...ico} />}>Parent Folder</Th>, width: 156, padLeft: 0, render: (r) => <span className={styles.secondary}>{r.parentFolder ?? "—"}</span> },
];

export function PacketView({ data }: { data: RecordSet<PacketRow> }) {
  return (
    <Workspace<PacketRow>
      sidebar={sidebar}
      title="SYSTEM"
      toolbar={{ hide: { label: "Hide fields" }, filter: { label: "Filter" }, group: { label: "Grouped by 1 field", active: true } }}
      fields={fields}
      toolbarTop={58.5}
      tableGap={18.5}
      data={data}
      table={{
        columns,
        rowKey: (r) => r.id,
        rowLabel: (r) => r.title,
        theme,
        selection: {
          width: 52,
          padLeft: 11,
          after: (_r, index) => <span className={styles.rowNum}>{index + 1}</span>,
        },
        renderGroupLabel: (g) => (
          <GroupLabel
            prefix={<span className={styles.secondary} style={{ fontSize: 11, fontWeight: 600 }}>FOLIO</span>}
            label={g.label ?? ""}
            labelColor="#ff4d6a"
            count={g.count}
            tone="countMuted"
            plural={false}
          />
        ),
        addRow: { tone: "red" },
      }}
    />
  );
}
