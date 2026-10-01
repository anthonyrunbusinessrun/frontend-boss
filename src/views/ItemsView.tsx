"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import type { FieldDef } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import { Workspace } from "@/components/view/Workspace";
import type { ItemRow, RecordSet } from "@/types";
import styles from "./views.module.css";

const sidebar: SidebarConfig = {
  cta: "Create new item",
  ctaGlow: true,
  padX: 12,
  itemGap: 0,
  sections: [
    {
      id: "fav",
      label: "My Favorites",
      items: [
        { id: "all-fav", label: "All Items", dot: "#22c55e", count: 3 },
        { id: "sourcing-fav", label: "Sourcing Pending", dot: "#f59e0b" },
      ],
    },
    {
      id: "views",
      label: "Views & Directories",
      collapsible: true,
      items: [
        { id: "all", label: "All Items", icon: "star", active: true },
        { id: "master", label: "Purchasing MASTER", icon: "folder" },
        { id: "jlg", label: "Purchasing View - JLG", icon: "folder" },
        { id: "fmc", label: "Purchasing View - FMC", icon: "folder" },
        { id: "sourcing", label: "Sourcing Pending", icon: "folder" },
        { id: "delivery", label: "Delivery Arrivals", icon: "folder" },
        { id: "report", label: "Vendor Item Report", icon: "folder" },
      ],
    },
    {
      id: "collab",
      label: "Collaborative",
      items: [
        { id: "team", label: "Team Shared View", dot: "#8b5cf6", count: 5, countTone: "purple" },
        { id: "proc", label: "Active Procurement", dot: "#22c55e" },
      ],
    },
  ],
};

const fields: FieldDef[] = ["N.", "Pic", "Title", "Overview", "Purstat", "Location", "Qty", "Kit", "Assigned"].map((name) => ({ name, kind: "text" }));

const theme: TableTheme = {
  border: "#141e35",
  radius: "8px",
  headH: 32,
  rowH: 60,
  rowA: "#0f172a",
  rowB: "#0b1220",
  footH: 56,
};

const kitTone = { "Kit Alpha": "kitAlpha", "Kit Beta": "kitBeta", "Kit Gamma": "kitGamma", "Kit Delta": "kitDelta" } as const;

// Widths from the measured header positions in Screens/10.
const columns: Column<ItemRow>[] = [
  { key: "n", header: "N.", width: 56, padLeft: 14, render: (r) => <span className={styles.rowNum} style={{ color: "#3a4f72" }}>{r.n}</span> },
  {
    key: "pic",
    header: "Pic",
    width: 52,
    padLeft: 0,
    render: (r) => <Image src={r.pic} alt="" width={40} height={40} className={styles.thumb} />,
  },
  { key: "title", header: "Title", width: 212, padLeft: 0, render: (r) => <span className={`${styles.cIce} ${styles.b6}`}>{r.title}</span> },
  { key: "overview", header: "Overview", width: 232, padLeft: 0, padRight: 6, render: (r) => <span className={styles.cInk}>{r.overview}</span> },
  { key: "purstat", header: "Purstat", width: 122, padLeft: 0, render: (r) => <Badge tone="purchased">{r.purstat}</Badge> },
  { key: "location", header: "Location", width: 112, padLeft: 0, render: (r) => <span className={styles.cInk}>{r.location}</span> },
  { key: "qty", header: "Qty", width: 92, padLeft: 0, render: (r) => <span className={`${styles.cIce} ${styles.b6}`}>{r.qty}</span> },
  { key: "kit", header: "Kit", width: 122, padLeft: 0, render: (r) => <Badge tone={kitTone[r.kit]}>{r.kit}</Badge> },
  { key: "assigned", header: "Assigned", width: 128, padLeft: 0, render: (r) => <span className={styles.cInk}>{r.assigned}</span> },
];

export function ItemsView({ data }: { data: RecordSet<ItemRow> }) {
  return (
    <Workspace<ItemRow>
      sidebar={sidebar}
      title="ALL ITEMS"
      titleSize={22}
      padX={25}
      subtitle="Manage physical item inventory, procurement statuses, and package distribution."
      subtitleDim
      titleAside={<Badge tone="countRed" shape="total">Total: 10 Items Listed</Badge>}
      toolbar={{ hide: { label: "Hide fields" }, filter: { label: "Filter" }, group: { label: "Grouped by 1 field", active: true } }}
      fields={fields}
      toolbarTop={92.5}
      tableGap={21.5}
      data={data}
      table={{ columns, rowKey: (r) => r.id, rowLabel: (r) => r.title, theme }}
      footer={{ placement: "inside", variant: "boxed" }}
    />
  );
}
