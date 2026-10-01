"use client";

import { Badge } from "@/components/ui/Badge";
import type { FieldDef } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import { Workspace } from "@/components/view/Workspace";
import type { RecordSet, TransactionRow } from "@/types";
import { GroupLabel } from "./cells";
import styles from "./views.module.css";

const sidebar: SidebarConfig = {
  cta: "Create new transaction",
  sections: [
    {
      id: "fav",
      label: "My Favorites",
      items: [
        { id: "hourly-fav", label: "HOURLY - Data Entry", icon: "star" },
        { id: "all", label: "All Transactions", icon: "star", active: true },
      ],
    },
    {
      id: "sys",
      label: "System Views",
      items: [
        { id: "hourly", label: "HOURLY - Data Entry", icon: "table" },
        { id: "product", label: "By Product", icon: "table" },
        { id: "kit", label: "By Kit", icon: "table" },
        { id: "pallet", label: "By Kit By Pallet", icon: "table" },
      ],
    },
  ],
};

const fields: FieldDef[] = ["Trans #", "Voucher", "Cust Ref", "Accrue", "Acct", "Item", "Memo", "DR Qty", "CR Qty", "Qty", "Direct", "Voucher Detail"].map((name) => ({ name, kind: "text" }));

const theme: TableTheme = {
  border: "#374151",
  radius: "8px 8px 0 0",
  headH: 46,
  headBorder: "#374151",
  rowH: 46,
  rowA: "#0f172a",
  rowB: "#0f172a",
  rowBorder: "#374151",
  rowBorderW: 1,
  groupBg: "#0b1224",
  groupH: 34,
  groupBorder: "#1e293b",
  groupBorderW: 2,
  sumBg: "#0b1224",
  sumH: 44,
  sumLabel: "#5a9fca",
  addBg: "#0b1224",
  addBorder: "#1e293b",
  cbBorder: "#1565c0",
  selectedBg: "#0f172a",
  cbCheckedBg: "#1565c0",
  cbCheckedBorder: "#1565c0",
  cbCheck: "#ffffff",
  footH: 56,
  footGap: 16,
};

const qty = (n: number) => (n === 0 ? <span className={styles.linkSoft}>{n}</span> : <span className={styles.cLight}>{n}</span>);

// Widths from the measured header positions in Screens/09.
const columns: Column<TransactionRow>[] = [
  { key: "trans", header: "Trans #", width: 72, padLeft: 0, render: (r) => <span className={styles.cLight}>{r.trans}</span> },
  { key: "voucher", header: "Voucher", width: 102, padLeft: 0, render: (r) => <span className={styles.linkSoft}>{r.voucher}</span> },
  { key: "custRef", header: "Cust Ref", width: 112, padLeft: 0, render: (r) => <span className={styles.cLight}>{r.custRef}</span> },
  { key: "accrue", header: "Accrue", width: 102, padLeft: 0, render: (r) => <span className={styles.cLight}>{r.accrue}</span> },
  { key: "acct", header: "Acct", width: 92, padLeft: 0, render: (r) => <Badge tone="acct" shape="tag">{r.acct}</Badge> },
  { key: "item", header: "Item", width: 142, padLeft: 0, render: (r) => <span className={styles.cLight}>{r.item}</span> },
  { key: "memo", header: "Memo", width: 57, padLeft: 0, padRight: 6, render: (r) => <span className={styles.cLight}>{r.memo}</span> },
  { key: "drQty", header: "DR Qty", width: 80, align: "right", headPadRight: 16, render: (r) => qty(r.drQty) },
  { key: "crQty", header: "CR Qty", width: 72, align: "right", render: (r) => qty(r.crQty) },
  { key: "qty", header: "Qty", width: 58, align: "right", padRight: 0, headPadRight: 16, render: (r) => <span className={styles.cLight}>{r.qty}</span> },
  { key: "direct", header: "Direct", width: 73, padLeft: 11, headPadLeft: 11, render: (r) => <span className={styles.cLight}>{r.direct}</span> },
  { key: "detail", header: "Voucher Detail", width: 125, padLeft: 0, render: (r) => <span className={styles.linkSoft}>{r.detail}</span> },
];

export function TransactionsView({ data }: { data: RecordSet<TransactionRow> }) {
  return (
    <Workspace<TransactionRow>
      sidebar={sidebar}
      title="ALL TRANSACTIONS"
      titleSize={22}
      subtitle="Manage physical item inventory, procurement statuses, and package distribution."
      // NEEDS CLARIFICATION: the badge says 10 items but four rows / "2 records" are drawn.
      titleAside={<Badge tone="countRed" shape="total">Total: 10 Items Listed</Badge>}
      toolbar={{ hide: { label: "Hide fields" }, filter: { label: "Filter" }, group: { label: "Grouped by 1 field", active: true } }}
      fields={fields}
      toolbarTop={84.5}
      tableGap={21.5}
      data={data}
      table={{
        columns,
        rowKey: (r) => r.id,
        rowLabel: (r) => r.trans,
        theme,
        selection: { width: 51, padLeft: 15, initial: ["t1"] },
        renderGroupLabel: (g) => <GroupLabel label={g.label ?? ""} count={g.count} tone="countPurple" />,
        sumRow: {
          label: "SUM",
          labelColumn: "trans",
          render: (g, c) => (g.sums && c.key in g.sums ? <span className={styles.strong}>{`Sum ${g.sums[c.key]}`}</span> : null),
        },
        addRow: { tone: "red" },
      }}
      footer={{ placement: "outside", variant: "boxed" }}
    />
  );
}
