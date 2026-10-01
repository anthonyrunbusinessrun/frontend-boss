"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import type { FieldDef } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import { LegendPanel, Workspace } from "@/components/view/Workspace";
import type { RecordSet, VoucherRow } from "@/types";
import { GroupLabel, usd } from "./cells";
import styles from "./views.module.css";

const sidebar: SidebarConfig = {
  // NEEDS CLARIFICATION: the design labels this button "Create new category" on the Vouchers screen.
  cta: "Create new category",
  sections: [
    { id: "views", label: "Views & Directories", collapsible: true, items: [{ id: "avl", label: "Active Voucher List", icon: "table", active: true }] },
    {
      id: "system",
      label: "System",
      collapsible: true,
      items: [
        { id: "audit", label: "Audit Ledgers", icon: "folder" },
        { id: "prefix", label: "Voucher Prefix Rules", icon: "folder" },
        { id: "batch", label: "Batch Operations", icon: "folder" },
        { id: "claims", label: "Security Claims", icon: "folder" },
      ],
    },
  ],
};

const fields: FieldDef[] = ["Voucher ID", "SP", "SVC", "Debit", "Credit", "Balance", "Scans", "Prefix", "Label", "ID", "Sum", "Cover"].map((name) => ({ name, kind: "text" }));

const theme: TableTheme = {
  border: "#0b1f3a",
  radius: "8px",
  headH: 41,
  headBorder: "#2d4469",
  headBorderW: 2,
  rowH: 44,
  rowA: "#0f172a",
  rowB: "#0b1220",
  rowBorder: "#2d4469",
  rowBorderW: 1,
  groupBg: "#0b1220",
  groupH: 35,
  groupBorder: "#2d4469",
  groupSize: 11,
  groupWeight: 600,
  groupLetterSpacing: "0.06em",
  groupColor: "#e2e8f0",
  addBg: "#0b1220",
  addBorder: "#151f35",
  selectedBg: "#0d1b33",
  selectedBar: "#2f7bea",
  cbBorder: "#64748b",
  cbCheckedBg: "#00ecfc",
  cbCheckedBorder: "#00ecfc",
  cbCheck: "#051424",
  footH: 59,
  footBg: "#0f172a",
  footBorder: "#151f35",
};

// Cell-aligned widths from the measured row positions in Screens/08.
const columns: Column<VoucherRow>[] = [
  { key: "exp", header: "+/-", width: 19, padLeft: 0, headPadLeft: 0, render: () => <ChevronRight size={16} className={styles.secondary} aria-hidden /> },
  { key: "voucherId", header: "Voucher ID", width: 108, padLeft: 0, headPadLeft: 16, render: (r) => <span className={`${styles.cyan} ${styles.strong}`} style={{ fontSize: 14 }}>{r.voucherId}</span> },
  { key: "sp", header: "SP", width: 63, align: "right", padRight: 16, headPadRight: 0, render: (r) => <span className={styles.body}>{r.sp}</span> },
  { key: "svc", header: "SVC", width: 117, padLeft: 13, headPadLeft: 32, render: (r) => <span className={styles.secondary}>{r.svc}</span> },
  { key: "debit", header: "Debit", width: 83, align: "right", headPadRight: 0, render: (r) => <span className={styles.body}>{usd(r.debit)}</span> },
  { key: "credit", header: "Credit", width: 93, align: "right", headPadRight: 0, render: (r) => <span className={styles.body}>{usd(r.credit)}</span> },
  { key: "balance", header: "Balance", width: 101, align: "right", headPadRight: 0, render: (r) => <span className={styles.strong}>{usd(r.balance)}</span> },
  { key: "scans", header: "Scans", width: 53, align: "center", render: (r) => <span className={styles.body}>{r.scans}</span> },
  { key: "prefix", header: "Prefix", width: 88, padLeft: 15, render: (r) => <span className={styles.secondary}>{r.prefix}</span> },
  { key: "label", header: "Label", width: 112, padLeft: 0, render: (r) => <Badge tone="voucherLabel" shape="mini">{r.label}</Badge> },
  { key: "ref", header: "ID", width: 68, padLeft: 0, render: (r) => <span className={styles.secondary}>{r.ref}</span> },
  { key: "sum", header: "Sum", width: 90, align: "right", headPadRight: 0, render: (r) => <span className={styles.body}>{usd(r.sum)}</span> },
  {
    key: "cover",
    header: "Cover",
    width: 51,
    padLeft: 0,
    render: (r) => (
      // NEEDS CLARIFICATION: cover art is clipped in the design; slivers cropped from the screen are used as placeholders.
      <Image src={r.cover} alt="" width={56} height={20} className={styles.thumb} style={{ borderRadius: 3, width: 56, height: 20 }} />
    ),
  },
];

export function VouchersView({ data, legend }: { data: RecordSet<VoucherRow>; legend: { title: string; entries: { term: string; text: string }[] } }) {
  return (
    <Workspace<VoucherRow>
      sidebar={sidebar}
      title="Active Voucher List"
      titleLight
      toolbar={{ hide: { label: "Hide fields" }, filter: { label: "Filter" }, group: { label: "Grouped by 1 field", active: true } }}
      fields={fields}
      toolbarTop={61.5}
      tableGap={21.5}
      data={data}
      table={{
        columns,
        rowKey: (r) => r.id,
        rowLabel: (r) => r.voucherId,
        theme,
        selection: { width: 92, padLeft: 15, initial: ["v1"], after: (_r, i) => <span className={styles.rowNum} style={{ marginLeft: 11, fontSize: 13 }}>{i + 1}</span> },
        renderGroupLabel: (g) => <GroupLabel label={g.label ?? ""} count={g.count} tone="countGreen" />,
        addRow: { tone: "red" },
      }}
      footer={{ placement: "inside", variant: "boxed" }}
      after={<LegendPanel title={legend.title} entries={legend.entries} />}
    />
  );
}
