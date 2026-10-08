"use client";

import { useMemo } from "react";
import { field } from "@/components/popovers/fields";
import type { Column } from "@/components/table/DataTable";
import { RowActions } from "@/components/ui/RowActions";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/dates";
import { invoiceBalance, invoiceStatus, invoiceTotal } from "@/services/ais/ledger";
import type { DocStatus, Invoice } from "@/types/ais";
import styles from "../ais.module.css";
import { AisList, QuickFilters } from "../AisList";
import { Money, StatusBadge } from "../cells";
import { useAis } from "../AisProvider";
import { useAisDrawers } from "../AisDrawers";
import { useQuickParam } from "../useQuickParam";

export type InvoiceRow = Invoice & { customer: string; total: number; balance: number; paid: number; displayStatus: DocStatus };

export function useInvoiceRows(): InvoiceRow[] {
  const { data } = useAis();
  return useMemo(
    () =>
      data.invoices
        .map((i) => {
          const total = invoiceTotal(i);
          const balance = i.status === "Sent" ? invoiceBalance(data, i) : i.status === "Draft" ? total : 0;
          return { ...i, customer: data.customers.find((c) => c.id === i.customerId)?.name ?? "Unknown customer", total, balance, paid: i.status === "Sent" ? total - invoiceBalance(data, i) : 0, displayStatus: invoiceStatus(data, i) };
        })
        .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number)),
    [data],
  );
}

const QUICK = ["All", "Draft", "Open", "Overdue", "Paid", "Void"];
const matches = (q: string, s: DocStatus) => (q === "All" ? true : q === "Open" ? s === "Open" || s === "Partially Paid" : s === q);

export function InvoicesPage() {
  const { ready } = useAis();
  const rows0 = useInvoiceRows();
  const drawers = useAisDrawers();
  const toast = useToast();
  const [quick, setQuick] = useQuickParam(["status", "filter"], QUICK, "All");
  const rows = useMemo(() => rows0.filter((r) => matches(quick, r.displayStatus)), [rows0, quick]);

  const actions = useMemo(
    () => ({
      open: (r: unknown) => drawers.open({ kind: "invoice", mode: "view", id: (r as InvoiceRow).id }),
      edit: (r: unknown) => {
        const i = r as InvoiceRow;
        if (i.status === "Void") toast.info("A void invoice cannot be edited.");
        drawers.open({ kind: "invoice", mode: i.status === "Void" ? "view" : "edit", id: i.id });
      },
      duplicate: (r: unknown) => {
        const i = r as InvoiceRow;
        drawers.open({ kind: "invoice", mode: "create", prefill: { customerId: i.customerId, lines: i.lines, notes: i.notes } });
      },
      remove: (r: unknown) => {
        const i = r as InvoiceRow;
        if (i.status === "Sent") toast.error(`Invoice ${i.number} has been sent and cannot be deleted. Open it and use Void instead.`);
        else drawers.requestDelete("invoice", i.id);
      },
    }),
    [drawers, toast],
  );

  const columns: Column<InvoiceRow>[] = [
    { key: "number", header: "Invoice #", width: 110, render: (r) => <span className={styles.link}>{r.number}</span> },
    { key: "customer", header: "Customer", width: 250, padLeft: 0, render: (r) => <span className={styles.strong}>{r.customer}</span> },
    { key: "issueDate", header: "Issued", width: 110, padLeft: 0, render: (r) => <span className={styles.dim}>{formatDate(r.issueDate)}</span> },
    { key: "dueDate", header: "Due", width: 110, padLeft: 0, render: (r) => <span className={r.displayStatus === "Overdue" ? styles.danger : styles.dim}>{formatDate(r.dueDate)}</span> },
    { key: "total", header: "Total", width: 130, align: "right", render: (r) => <Money cents={r.total} /> },
    { key: "balance", header: "Balance due", width: 130, align: "right", render: (r) => <Money cents={r.balance} dashZero /> },
    { key: "displayStatus", header: "Status", width: 140, padLeft: 16, render: (r) => <StatusBadge status={r.displayStatus} /> },
    { key: "actions", header: "Actions", width: 120, padLeft: 0, render: (r) => <RowActions label={r.number} iconSize={15} /> },
  ];
  const fields = [
    field("Invoice #", "number"), field("Customer", "customer"), field("Issued", "issueDate", { type: "date" }), field("Due", "dueDate", { type: "date" }),
    field("Total", "total", { type: "number" }), field("Balance due", "balance", { type: "number" }), field("Status", "displayStatus", { kind: "select" }), field("Reference", "reference"),
  ];

  return (
    <AisList<InvoiceRow>
      title="Invoices"
      subtitle="Create, send and track customer invoices."
      singular="invoice"
      plural="invoices"
      rows={rows}
      loading={!ready}
      columns={columns}
      fields={fields}
      rowLabel={(r) => r.number}
      actions={actions}
      create={{ label: "New invoice", onClick: () => drawers.open({ kind: "invoice", mode: "create" }) }}
      exportSpec={{ filename: "invoices", headers: ["Invoice #", "Customer", "Issued", "Due", "Total", "Balance due", "Status", "Reference"], row: (r) => [r.number, r.customer, r.issueDate, r.dueDate, (r.total / 100).toFixed(2), (r.balance / 100).toFixed(2), r.displayStatus, r.reference] }}
      emptyTitle={quick === "All" ? "No invoices yet" : "No invoices match this filter"}
      emptyDescription={quick === "All" ? "Create an invoice to bill a customer." : "Choose another status above, or create a new invoice."}
      above={
        <QuickFilters
          label="Filter invoices by status"
          value={quick}
          onChange={setQuick}
          options={QUICK.map((q) => ({ value: q, label: q, count: rows0.filter((r) => matches(q, r.displayStatus)).length }))}
        />
      }
    />
  );
}
