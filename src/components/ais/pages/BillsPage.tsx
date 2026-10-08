"use client";

import { useMemo } from "react";
import { field } from "@/components/popovers/fields";
import type { Column } from "@/components/table/DataTable";
import { RowActions } from "@/components/ui/RowActions";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/dates";
import { billBalance, billStatus, billTotal } from "@/services/ais/ledger";
import type { Bill, DocStatus } from "@/types/ais";
import styles from "../ais.module.css";
import { AisList, QuickFilters } from "../AisList";
import { Money, StatusBadge } from "../cells";
import { useAis } from "../AisProvider";
import { useAisDrawers } from "../AisDrawers";
import { useQuickParam } from "../useQuickParam";

export type BillRow = Bill & { vendor: string; total: number; balance: number; paid: number; displayStatus: DocStatus };

export function useBillRows(): BillRow[] {
  const { data } = useAis();
  return useMemo(
    () =>
      data.bills
        .map((b) => {
          const total = billTotal(b);
          const balance = b.status === "Approved" ? billBalance(data, b) : b.status === "Void" ? 0 : total;
          return { ...b, vendor: data.vendors.find((v) => v.id === b.vendorId)?.name ?? "Unknown vendor", total, balance, paid: b.status === "Approved" ? total - billBalance(data, b) : 0, displayStatus: billStatus(data, b) };
        })
        .sort((a, b) => b.billDate.localeCompare(a.billDate) || b.number.localeCompare(a.number)),
    [data],
  );
}

const QUICK = ["All", "Draft", "Awaiting Approval", "Open", "Overdue", "Paid", "Void"];
const matches = (q: string, s: DocStatus) => (q === "All" ? true : q === "Open" ? s === "Approved" || s === "Partially Paid" : s === q);

export function BillsPage() {
  const { ready } = useAis();
  const rows0 = useBillRows();
  const drawers = useAisDrawers();
  const toast = useToast();
  const [quick, setQuick] = useQuickParam(["status", "filter"], QUICK, "All");
  const rows = useMemo(() => rows0.filter((r) => matches(quick, r.displayStatus)), [rows0, quick]);

  const actions = useMemo(
    () => ({
      open: (r: unknown) => drawers.open({ kind: "bill", mode: "view", id: (r as BillRow).id }),
      edit: (r: unknown) => {
        const b = r as BillRow;
        if (b.status === "Void") toast.info("A void bill cannot be edited.");
        drawers.open({ kind: "bill", mode: b.status === "Void" ? "view" : "edit", id: b.id });
      },
      duplicate: (r: unknown) => {
        const b = r as BillRow;
        drawers.open({ kind: "bill", mode: "create", prefill: { vendorId: b.vendorId, lines: b.lines } });
      },
      remove: (r: unknown) => {
        const b = r as BillRow;
        if (b.status === "Approved") toast.error(`Bill ${b.number} is approved and cannot be deleted. Open it and use Void instead.`);
        else drawers.requestDelete("bill", b.id);
      },
    }),
    [drawers, toast],
  );

  const columns: Column<BillRow>[] = [
    { key: "number", header: "Bill #", width: 110, render: (r) => <span className={styles.link}>{r.number}</span> },
    { key: "vendor", header: "Vendor", width: 230, padLeft: 0, render: (r) => <span className={styles.strong}>{r.vendor}</span> },
    { key: "billDate", header: "Bill date", width: 110, padLeft: 0, render: (r) => <span className={styles.dim}>{formatDate(r.billDate)}</span> },
    { key: "dueDate", header: "Due", width: 110, padLeft: 0, render: (r) => <span className={r.displayStatus === "Overdue" ? styles.danger : styles.dim}>{formatDate(r.dueDate)}</span> },
    { key: "total", header: "Total", width: 120, align: "right", render: (r) => <Money cents={r.total} /> },
    { key: "balance", header: "Balance due", width: 120, align: "right", render: (r) => <Money cents={r.balance} dashZero /> },
    { key: "displayStatus", header: "Status", width: 160, padLeft: 16, render: (r) => <StatusBadge status={r.displayStatus} /> },
    { key: "actions", header: "Actions", width: 120, padLeft: 0, render: (r) => <RowActions label={r.number} iconSize={15} /> },
  ];
  const fields = [
    field("Bill #", "number"), field("Vendor", "vendor"), field("Vendor ref.", "reference"), field("Bill date", "billDate", { type: "date" }), field("Due", "dueDate", { type: "date" }),
    field("Total", "total", { type: "number" }), field("Balance due", "balance", { type: "number" }), field("Status", "displayStatus", { kind: "select" }),
  ];

  return (
    <AisList<BillRow>
      title="Bills"
      subtitle="Record vendor bills, route them for approval and pay them."
      singular="bill"
      plural="bills"
      rows={rows}
      loading={!ready}
      columns={columns}
      fields={fields}
      rowLabel={(r) => r.number}
      actions={actions}
      create={{ label: "New bill", onClick: () => drawers.open({ kind: "bill", mode: "create" }) }}
      exportSpec={{ filename: "bills", headers: ["Bill #", "Vendor", "Vendor ref.", "Bill date", "Due", "Total", "Balance due", "Status"], row: (r) => [r.number, r.vendor, r.reference, r.billDate, r.dueDate, (r.total / 100).toFixed(2), (r.balance / 100).toFixed(2), r.displayStatus] }}
      emptyTitle={quick === "All" ? "No bills yet" : "No bills match this filter"}
      emptyDescription={quick === "All" ? "Enter a bill to record what you owe a vendor." : "Choose another status above, or enter a new bill."}
      above={
        <QuickFilters
          label="Filter bills by status"
          value={quick}
          onChange={setQuick}
          options={QUICK.map((q) => ({ value: q, label: q, count: rows0.filter((r) => matches(q, r.displayStatus)).length }))}
        />
      }
    />
  );
}
