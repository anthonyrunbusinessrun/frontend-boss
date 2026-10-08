"use client";

import { CreditCard } from "lucide-react";
import { useMemo } from "react";
import { field } from "@/components/popovers/fields";
import type { Column } from "@/components/table/DataTable";
import { Button } from "@/components/ui/Button";
import { RowActions } from "@/components/ui/RowActions";
import { diffDays, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { AGING_BUCKETS, agingBucket, agingReport, type AgingBucket } from "@/services/ais/reports";
import { isOpenInvoice } from "@/services/ais/ledger";
import styles from "../ais.module.css";
import { AisList, QuickFilters } from "../AisList";
import { Money, StatusBadge } from "../cells";
import { useAis } from "../AisProvider";
import { useAisDrawers } from "../AisDrawers";
import { useQuickParam } from "../useQuickParam";
import { useInvoiceRows, type InvoiceRow } from "./InvoicesPage";

type ArRow = InvoiceRow & { daysLate: number; bucket: AgingBucket };
const QUICK = ["All", "Overdue", "Current", "Partially paid"];

/** Open receivables: who owes what, how late it is, and a one-click way to record the payment. */
export function ReceivablesPage() {
  const { data, ready } = useAis();
  const all = useInvoiceRows();
  const drawers = useAisDrawers();
  const [quick, setQuick] = useQuickParam(["filter", "status"], QUICK, "All");
  const [bucket, setBucket] = useQuickParam(["bucket"], ["", ...AGING_BUCKETS], "");

  const open = useMemo<ArRow[]>(
    () =>
      all
        .filter((r) => isOpenInvoice(data, r))
        .map((r) => ({ ...r, daysLate: Math.max(0, diffDays(data.settings.reportingDate, r.dueDate)), bucket: agingBucket(r.dueDate, data.settings.reportingDate) }))
        .sort((a, b) => b.daysLate - a.daysLate || a.dueDate.localeCompare(b.dueDate)),
    [all, data],
  );
  const rows = useMemo(
    () =>
      open.filter((r) => (quick === "All" ? true : quick === "Overdue" ? r.displayStatus === "Overdue" : quick === "Current" ? r.daysLate === 0 : r.paid > 0) && (bucket === "" || r.bucket === bucket)),
    [open, quick, bucket],
  );

  const aging = useMemo(() => agingReport(data, "ar"), [data]);

  const actions = useMemo(
    () => ({
      open: (r: unknown) => drawers.open({ kind: "invoice", mode: "view", id: (r as ArRow).id }),
      edit: (r: unknown) => drawers.open({ kind: "invoice", mode: "edit", id: (r as ArRow).id }),
    }),
    [drawers],
  );

  const columns: Column<ArRow>[] = [
    { key: "number", header: "Invoice #", width: 100, render: (r) => <span className={styles.link}>{r.number}</span> },
    { key: "customer", header: "Customer", width: 200, padLeft: 0, render: (r) => <span className={styles.strong}>{r.customer}</span> },
    { key: "dueDate", header: "Due", width: 105, padLeft: 0, render: (r) => <span className={r.daysLate > 0 ? styles.danger : styles.dim}>{formatDate(r.dueDate)}</span> },
    { key: "daysLate", header: "Days late", width: 85, align: "right", render: (r) => (r.daysLate > 0 ? <span className={styles.danger}>{r.daysLate}</span> : <span className={styles.muted}>–</span>) },
    { key: "total", header: "Invoice total", width: 115, align: "right", render: (r) => <Money cents={r.total} /> },
    { key: "paid", header: "Paid", width: 105, align: "right", render: (r) => <Money cents={r.paid} dashZero /> },
    { key: "balance", header: "Balance", width: 115, align: "right", render: (r) => <Money cents={r.balance} /> },
    { key: "displayStatus", header: "Status", width: 125, padLeft: 16, render: (r) => <StatusBadge status={r.displayStatus} /> },
    {
      key: "actions",
      header: "Actions",
      width: 170,
      padLeft: 0,
      render: (r) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <Button
            variant="secondary"
            size="sm"
            icon={<CreditCard size={13} />}
            onClick={() => drawers.open({ kind: "payment", mode: "create", prefill: { direction: "received", partyId: r.customerId, documentId: r.id } })}
          >
            Record payment
          </Button>
          <RowActions icons={["edit"]} label={r.number} iconSize={15} />
        </span>
      ),
    },
  ];
  const fields = [
    field("Invoice #", "number"), field("Customer", "customer"), field("Issued", "issueDate", { type: "date" }), field("Due", "dueDate", { type: "date" }),
    field("Days late", "daysLate", { type: "number" }), field("Invoice total", "total", { type: "number" }), field("Paid", "paid", { type: "number" }),
    field("Balance", "balance", { type: "number" }), field("Status", "displayStatus", { kind: "select" }), field("Aging bucket", "bucket"),
  ];

  return (
    <AisList<ArRow>
      title="Accounts Receivable"
      subtitle={`${open.length} open invoice${open.length === 1 ? "" : "s"} · ${formatMoney(aging.totals.total)} outstanding as of ${formatDate(data.settings.reportingDate)}`}
      singular="receivable"
      plural="receivables"
      rows={rows}
      loading={!ready}
      columns={columns}
      fields={fields}
      rowLabel={(r) => r.number}
      actions={actions}
      create={{ label: "New invoice", onClick: () => drawers.open({ kind: "invoice", mode: "create" }) }}
      exportSpec={{ filename: "accounts-receivable", headers: ["Invoice #", "Customer", "Issued", "Due", "Days late", "Total", "Paid", "Balance", "Status", "Aging bucket"], row: (r) => [r.number, r.customer, r.issueDate, r.dueDate, r.daysLate, (r.total / 100).toFixed(2), (r.paid / 100).toFixed(2), (r.balance / 100).toFixed(2), r.displayStatus, r.bucket] }}
      emptyTitle={open.length === 0 ? "Nothing is owed to you" : "No receivables match this filter"}
      emptyDescription={open.length === 0 ? "Every sent invoice has been paid. Create a new invoice to bill a customer." : "Clear the filter above to see all open invoices."}
      above={
        <>
          <div className={styles.cards}>
            {AGING_BUCKETS.map((b) => (
              <button key={b} type="button" className={`${styles.card} ${styles.cardButton} ${bucket === b ? styles.cardOn : ""}`} aria-pressed={bucket === b} onClick={() => setBucket(bucket === b ? "" : b)}>
                <div className={styles.cardLabel}>{b === "Current" ? "Not yet due" : `${b} days late`}</div>
                <div className={`${styles.cardValue} ${b !== "Current" && aging.totals.buckets[b] > 0 ? styles.danger : ""}`}>{formatMoney(aging.totals.buckets[b])}</div>
                <div className={styles.cardNote}>{open.filter((r) => r.bucket === b).length} invoice{open.filter((r) => r.bucket === b).length === 1 ? "" : "s"}</div>
              </button>
            ))}
          </div>
          <QuickFilters
            label="Filter receivables"
            value={quick}
            onChange={setQuick}
            options={QUICK.map((q) => ({ value: q, label: q, count: open.filter((r) => (q === "All" ? true : q === "Overdue" ? r.displayStatus === "Overdue" : q === "Current" ? r.daysLate === 0 : r.paid > 0)).length }))}
          />
        </>
      }
    />
  );
}
