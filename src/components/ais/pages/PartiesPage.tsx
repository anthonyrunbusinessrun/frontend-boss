"use client";

import { useMemo } from "react";
import { field, form } from "@/components/popovers/fields";
import type { Column } from "@/components/table/DataTable";
import { RowActions } from "@/components/ui/RowActions";
import { formatMoney } from "@/lib/money";
import { billBalance, invoiceBalance } from "@/services/ais/ledger";
import type { Party } from "@/types/ais";
import styles from "../ais.module.css";
import { AisList, QuickFilters } from "../AisList";
import { BossRef, Money, PartyStatusBadge } from "../cells";
import { useAis } from "../AisProvider";
import { useAisDrawers } from "../AisDrawers";
import { useQuickParam } from "../useQuickParam";
import { useToast } from "@/components/ui/Toast";

type PartyRow = Party & { openBalance: number; documents: number };

/** Customers and vendors share one screen: same fields, same actions, different documents behind them. */
export function PartiesPage({ party }: { party: "customer" | "vendor" }) {
  const { data, ready } = useAis();
  const drawers = useAisDrawers();
  const toast = useToast();
  const isCustomer = party === "customer";
  const [quick, setQuick] = useQuickParam(["status"], ["All", "Active", "Inactive"], "All");

  const all = useMemo<PartyRow[]>(() => {
    if (isCustomer) {
      return data.customers.map((c) => {
        const invoices = data.invoices.filter((i) => i.customerId === c.id);
        return { ...c, documents: invoices.length, openBalance: invoices.filter((i) => i.status === "Sent").reduce((s, i) => s + invoiceBalance(data, i), 0) };
      });
    }
    return data.vendors.map((v) => {
      const bills = data.bills.filter((b) => b.vendorId === v.id);
      return { ...v, documents: bills.length, openBalance: bills.filter((b) => b.status === "Approved").reduce((s, b) => s + billBalance(data, b), 0) };
    });
  }, [data, isCustomer]);

  const rows = useMemo(() => all.filter((p) => quick === "All" || p.status === quick).sort((a, b) => a.name.localeCompare(b.name)), [all, quick]);

  const actions = useMemo(
    () => ({
      open: (r: unknown) => drawers.open({ kind: party, mode: "view", id: (r as PartyRow).id }),
      edit: (r: unknown) => drawers.open({ kind: party, mode: "edit", id: (r as PartyRow).id }),
      remove: (r: unknown) => {
        const p = r as PartyRow;
        if (p.documents > 0) toast.error(`${p.name} has ${p.documents} ${isCustomer ? "invoice" : "bill"}${p.documents === 1 ? "" : "s"}. Mark the ${party} inactive instead of deleting it.`);
        else drawers.requestDelete(party, p.id);
      },
    }),
    [drawers, party, isCustomer, toast],
  );

  const columns: Column<PartyRow>[] = [
    { key: "code", header: "Code", width: 90, render: (r) => <span className={styles.link}>{r.code}</span> },
    { key: "name", header: isCustomer ? "Customer" : "Vendor", width: 250, padLeft: 0, render: (r) => <span className={styles.strong}>{r.name}</span> },
    { key: "email", header: "Email", width: 290, padLeft: 0, render: (r) => <span style={{ color: "var(--accent-cyan)" }}>{r.email || "–"}</span> },
    { key: "terms", header: "Terms", width: 108, padLeft: 0, render: (r) => <span className={styles.dim}>{r.terms}</span> },
    { key: "openBalance", header: isCustomer ? "Open balance" : "Amount owed", width: 120, align: "right", render: (r) => <Money cents={r.openBalance} dashZero /> },
    { key: "status", header: "Status", width: 100, padLeft: 16, render: (r) => <PartyStatusBadge status={r.status} /> },
    { key: "profileRef", header: "BOSS owner", width: 80, padLeft: 0, render: (r) => <BossRef code={r.profileRef} /> },
    { key: "actions", header: "Actions", width: 80, padLeft: 0, render: (r) => <RowActions icons={["edit", "delete"]} label={r.name} iconSize={15} /> },
  ];

  const fields = [
    field("Code", "code"),
    field("Name", "name"),
    field("Contact", "contact"),
    field("Email", "email"),
    field("Phone", "phone"),
    field("Terms", "terms", { kind: "select" }),
    field(isCustomer ? "Open balance" : "Amount owed", "openBalance", { type: "number", form: form.number() }),
    field("Status", "status", { kind: "select" }),
    field("BOSS owner", "profileRef"),
  ];

  const singular = isCustomer ? "customer" : "vendor";
  return (
    <AisList<PartyRow>
      title={isCustomer ? "Customers" : "Vendors"}
      subtitle={isCustomer ? `${all.filter((c) => c.status === "Active").length} active · ${formatMoney(all.reduce((s, c) => s + c.openBalance, 0))} receivable` : `${all.filter((c) => c.status === "Active").length} active · ${formatMoney(all.reduce((s, c) => s + c.openBalance, 0))} payable`}
      singular={singular}
      plural={`${singular}s`}
      rows={rows}
      loading={!ready}
      columns={columns}
      fields={fields}
      rowLabel={(r) => r.name}
      actions={actions}
      create={{ label: `New ${singular}`, onClick: () => drawers.open({ kind: party, mode: "create" }) }}
      exportSpec={{ filename: `${singular}s`, headers: ["Code", "Name", "Contact", "Email", "Phone", "Terms", "Open balance", "Status", "BOSS owner"], row: (r) => [r.code, r.name, r.contact, r.email, r.phone, r.terms, (r.openBalance / 100).toFixed(2), r.status, r.profileRef] }}
      emptyDescription={`Add your first ${singular} to start ${isCustomer ? "invoicing" : "recording bills"}.`}
      above={
        <QuickFilters
          label={`Filter ${singular}s by status`}
          value={quick}
          onChange={setQuick}
          options={[
            { value: "All", label: "All", count: all.length },
            { value: "Active", label: "Active", count: all.filter((p) => p.status === "Active").length },
            { value: "Inactive", label: "Inactive", count: all.filter((p) => p.status === "Inactive").length },
          ]}
        />
      }
    />
  );
}
