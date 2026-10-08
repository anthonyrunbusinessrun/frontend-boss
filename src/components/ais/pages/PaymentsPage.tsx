"use client";

import { useMemo } from "react";
import { field } from "@/components/popovers/fields";
import type { Column } from "@/components/table/DataTable";
import { Badge } from "@/components/ui/Badge";
import { RowActions } from "@/components/ui/RowActions";
import { formatDate } from "@/lib/dates";
import { paymentTotal } from "@/services/ais/ledger";
import type { Payment } from "@/types/ais";
import styles from "../ais.module.css";
import { AisList, QuickFilters } from "../AisList";
import { Money } from "../cells";
import { useAis } from "../AisProvider";
import { useAisDrawers } from "../AisDrawers";
import { useQuickParam } from "../useQuickParam";

type PaymentRow = Payment & { party: string; type: "Received" | "Made"; amount: number; appliedTo: string; bank: string };
const QUICK = ["All", "Received", "Made"];

export function PaymentsPage() {
  const { data, ready } = useAis();
  const drawers = useAisDrawers();
  const [quick, setQuick] = useQuickParam(["type", "status"], QUICK, "All");

  const all = useMemo<PaymentRow[]>(
    () =>
      data.payments
        .map((p) => {
          const received = p.direction === "received";
          const docs = p.allocations.map((a) => (received ? data.invoices.find((i) => i.id === a.documentId)?.number : data.bills.find((b) => b.id === a.documentId)?.number) ?? "deleted").join(", ");
          return {
            ...p,
            party: (received ? data.customers.find((c) => c.id === p.partyId)?.name : data.vendors.find((v) => v.id === p.partyId)?.name) ?? "Unknown",
            type: received ? ("Received" as const) : ("Made" as const),
            amount: paymentTotal(p),
            appliedTo: docs,
            bank: data.accounts.find((a) => a.id === p.accountId)?.name ?? "",
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)),
    [data],
  );
  const rows = useMemo(() => all.filter((p) => quick === "All" || p.type === quick), [all, quick]);

  const actions = useMemo(
    () => ({
      open: (r: unknown) => drawers.open({ kind: "payment", mode: "view", id: (r as PaymentRow).id }),
      remove: (r: unknown) => drawers.requestDelete("payment", (r as PaymentRow).id),
    }),
    [drawers],
  );

  const columns: Column<PaymentRow>[] = [
    { key: "number", header: "Payment #", width: 110, render: (r) => <span className={styles.link}>{r.number}</span> },
    { key: "date", header: "Date", width: 120, padLeft: 0, render: (r) => <span className={styles.dim}>{formatDate(r.date)}</span> },
    { key: "type", header: "Type", width: 120, padLeft: 0, render: (r) => <Badge tone={r.type === "Received" ? "statusPaid" : "statusAwaiting"}>{r.type}</Badge> },
    { key: "party", header: "Customer / vendor", width: 230, padLeft: 0, render: (r) => <span className={styles.strong}>{r.party}</span> },
    { key: "method", header: "Method", width: 130, padLeft: 0, render: (r) => <span className={styles.dim}>{r.method}</span> },
    { key: "appliedTo", header: "Applied to", width: 170, padLeft: 0, render: (r) => <span className={styles.dim}>{r.appliedTo}</span> },
    { key: "amount", header: "Amount", width: 140, align: "right", render: (r) => <Money cents={r.amount} /> },
    { key: "actions", header: "Actions", width: 90, padLeft: 16, render: (r) => <RowActions icons={["delete"]} label={r.number} iconSize={15} /> },
  ];
  const fields = [
    field("Payment #", "number"), field("Date", "date", { type: "date" }), field("Type", "type", { kind: "select" }), field("Customer / vendor", "party"),
    field("Method", "method", { kind: "select" }), field("Applied to", "appliedTo"), field("Amount", "amount", { type: "number" }), field("Reference", "reference"),
  ];
  const received = all.filter((p) => p.type === "Received").reduce((s, p) => s + p.amount, 0);
  const made = all.filter((p) => p.type === "Made").reduce((s, p) => s + p.amount, 0);

  return (
    <AisList<PaymentRow>
      title="Payments"
      subtitle="Money received from customers and paid to vendors."
      singular="payment"
      plural="payments"
      rows={rows}
      loading={!ready}
      columns={columns}
      fields={fields}
      rowLabel={(r) => r.number}
      actions={actions}
      create={{ label: "Record payment", onClick: () => drawers.open({ kind: "payment", mode: "create" }) }}
      exportSpec={{ filename: "payments", headers: ["Payment #", "Date", "Type", "Customer / vendor", "Method", "Bank account", "Applied to", "Amount", "Reference"], row: (r) => [r.number, r.date, r.type, r.party, r.method, r.bank, r.appliedTo, (r.amount / 100).toFixed(2), r.reference] }}
      emptyTitle="No payments recorded"
      emptyDescription="Record a payment to apply cash to an open invoice or bill."
      above={
        <QuickFilters
          label="Filter payments by type"
          value={quick}
          onChange={setQuick}
          options={[
            { value: "All", label: "All", count: all.length },
            { value: "Received", label: `Received`, count: all.filter((p) => p.type === "Received").length },
            { value: "Made", label: `Made`, count: all.filter((p) => p.type === "Made").length },
          ]}
        />
      }
      toolbarExtra={<span className={styles.stickyNote}>In {(received / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} · Out {(made / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>}
    />
  );
}
