"use client";

import { CreditCard } from "lucide-react";
import { useMemo } from "react";
import { field } from "@/components/popovers/fields";
import type { Column } from "@/components/table/DataTable";
import { Button } from "@/components/ui/Button";
import { RowActions } from "@/components/ui/RowActions";
import { diffDays, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isOpenBill } from "@/services/ais/ledger";
import { AGING_BUCKETS, agingBucket, agingReport, type AgingBucket } from "@/services/ais/reports";
import styles from "../ais.module.css";
import { AisList, QuickFilters } from "../AisList";
import { Money, StatusBadge } from "../cells";
import { useAis } from "../AisProvider";
import { useAisDrawers } from "../AisDrawers";
import { useQuickParam } from "../useQuickParam";
import { useBillRows, type BillRow } from "./BillsPage";

type ApRow = BillRow & { daysLate: number; bucket: AgingBucket };
const QUICK = ["All", "Overdue", "Due soon", "Partially paid"];

/** Approved bills still owed: what is due, how late, and a one-click way to pay. */
export function PayablesPage() {
  const { data, ready } = useAis();
  const all = useBillRows();
  const drawers = useAisDrawers();
  const [quick, setQuick] = useQuickParam(["filter", "status"], QUICK, "All");
  const [bucket, setBucket] = useQuickParam(["bucket"], ["", ...AGING_BUCKETS], "");
  const asOf = data.settings.reportingDate;

  const open = useMemo<ApRow[]>(
    () =>
      all
        .filter((r) => isOpenBill(data, r))
        .map((r) => ({ ...r, daysLate: Math.max(0, diffDays(asOf, r.dueDate)), bucket: agingBucket(r.dueDate, asOf) }))
        .sort((a, b) => b.daysLate - a.daysLate || a.dueDate.localeCompare(b.dueDate)),
    [all, data, asOf],
  );
  const test = (q: string, r: ApRow) => (q === "All" ? true : q === "Overdue" ? r.displayStatus === "Overdue" : q === "Due soon" ? r.daysLate === 0 && diffDays(r.dueDate, asOf) <= 14 : r.paid > 0);
  const rows = useMemo(() => open.filter((r) => test(quick, r) && (bucket === "" || r.bucket === bucket)), [open, quick, bucket]);
  const aging = useMemo(() => agingReport(data, "ap"), [data]);

  const actions = useMemo(
    () => ({
      open: (r: unknown) => drawers.open({ kind: "bill", mode: "view", id: (r as ApRow).id }),
      edit: (r: unknown) => drawers.open({ kind: "bill", mode: "edit", id: (r as ApRow).id }),
    }),
    [drawers],
  );

  const columns: Column<ApRow>[] = [
    { key: "number", header: "Bill #", width: 100, render: (r) => <span className={styles.link}>{r.number}</span> },
    { key: "vendor", header: "Vendor", width: 210, padLeft: 0, render: (r) => <span className={styles.strong}>{r.vendor}</span> },
    { key: "dueDate", header: "Due", width: 105, padLeft: 0, render: (r) => <span className={r.daysLate > 0 ? styles.danger : styles.dim}>{formatDate(r.dueDate)}</span> },
    { key: "daysLate", header: "Days late", width: 85, align: "right", render: (r) => (r.daysLate > 0 ? <span className={styles.danger}>{r.daysLate}</span> : <span className={styles.muted}>–</span>) },
    { key: "total", header: "Bill total", width: 115, align: "right", render: (r) => <Money cents={r.total} /> },
    { key: "paid", header: "Paid", width: 105, align: "right", render: (r) => <Money cents={r.paid} dashZero /> },
    { key: "balance", header: "Balance", width: 115, align: "right", render: (r) => <Money cents={r.balance} /> },
    { key: "displayStatus", header: "Status", width: 150, padLeft: 16, render: (r) => <StatusBadge status={r.displayStatus} /> },
    {
      key: "actions",
      header: "Actions",
      width: 130,
      padLeft: 0,
      render: (r) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <Button variant="secondary" size="sm" icon={<CreditCard size={13} />} onClick={() => drawers.open({ kind: "payment", mode: "create", prefill: { direction: "made", partyId: r.vendorId, documentId: r.id } })}>
            Pay
          </Button>
          <RowActions icons={["edit"]} label={r.number} iconSize={15} />
        </span>
      ),
    },
  ];
  const fields = [
    field("Bill #", "number"), field("Vendor", "vendor"), field("Bill date", "billDate", { type: "date" }), field("Due", "dueDate", { type: "date" }),
    field("Days late", "daysLate", { type: "number" }), field("Bill total", "total", { type: "number" }), field("Paid", "paid", { type: "number" }),
    field("Balance", "balance", { type: "number" }), field("Status", "displayStatus", { kind: "select" }), field("Aging bucket", "bucket"),
  ];

  return (
    <AisList<ApRow>
      title="Accounts Payable"
      subtitle={`${open.length} open bill${open.length === 1 ? "" : "s"} · ${formatMoney(aging.totals.total)} owed as of ${formatDate(asOf)}`}
      singular="payable"
      plural="payables"
      rows={rows}
      loading={!ready}
      columns={columns}
      fields={fields}
      rowLabel={(r) => r.number}
      actions={actions}
      create={{ label: "New bill", onClick: () => drawers.open({ kind: "bill", mode: "create" }) }}
      exportSpec={{ filename: "accounts-payable", headers: ["Bill #", "Vendor", "Bill date", "Due", "Days late", "Total", "Paid", "Balance", "Status", "Aging bucket"], row: (r) => [r.number, r.vendor, r.billDate, r.dueDate, r.daysLate, (r.total / 100).toFixed(2), (r.paid / 100).toFixed(2), (r.balance / 100).toFixed(2), r.displayStatus, r.bucket] }}
      emptyTitle={open.length === 0 ? "You do not owe anything" : "No payables match this filter"}
      emptyDescription={open.length === 0 ? "Every approved bill has been paid." : "Clear the filter above to see all open bills."}
      above={
        <>
          <div className={styles.cards}>
            {AGING_BUCKETS.map((b) => (
              <button key={b} type="button" className={`${styles.card} ${styles.cardButton} ${bucket === b ? styles.cardOn : ""}`} aria-pressed={bucket === b} onClick={() => setBucket(bucket === b ? "" : b)}>
                <div className={styles.cardLabel}>{b === "Current" ? "Not yet due" : `${b} days late`}</div>
                <div className={`${styles.cardValue} ${b !== "Current" && aging.totals.buckets[b] > 0 ? styles.danger : ""}`}>{formatMoney(aging.totals.buckets[b])}</div>
                <div className={styles.cardNote}>{open.filter((r) => r.bucket === b).length} bill{open.filter((r) => r.bucket === b).length === 1 ? "" : "s"}</div>
              </button>
            ))}
          </div>
          <QuickFilters label="Filter payables" value={quick} onChange={setQuick} options={QUICK.map((q) => ({ value: q, label: q, count: open.filter((r) => test(q, r)).length }))} />
        </>
      }
    />
  );
}
