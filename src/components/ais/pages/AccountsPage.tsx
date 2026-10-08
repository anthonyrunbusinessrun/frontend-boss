"use client";

import { useMemo } from "react";
import { field } from "@/components/popovers/fields";
import type { Column } from "@/components/table/DataTable";
import { Badge } from "@/components/ui/Badge";
import { RowActions } from "@/components/ui/RowActions";
import { useToast } from "@/components/ui/Toast";
import { accountBalance, postedLines, SYSTEM_CODES } from "@/services/ais/ledger";
import type { Account } from "@/types/ais";
import styles from "../ais.module.css";
import { AisList, QuickFilters } from "../AisList";
import { Money } from "../cells";
import { useAis } from "../AisProvider";
import { useAisDrawers } from "../AisDrawers";
import { useQuickParam } from "../useQuickParam";
import { ACCOUNT_TYPES } from "../drawers/AccountDrawer";

type AccountRow = Account & { balance: number; lines: number; status: string };

export function AccountsPage() {
  const { data, ready } = useAis();
  const drawers = useAisDrawers();
  const toast = useToast();
  const [quick, setQuick] = useQuickParam(["type"], ["All", ...ACCOUNT_TYPES], "All");

  const all = useMemo<AccountRow[]>(() => {
    const counts = new Map<string, number>();
    for (const l of postedLines(data)) counts.set(l.accountId, (counts.get(l.accountId) ?? 0) + 1);
    return data.accounts.map((a) => ({ ...a, balance: accountBalance(data, a.id, { to: data.settings.reportingDate }), lines: counts.get(a.id) ?? 0, status: a.active ? "Active" : "Inactive" })).sort((a, b) => a.code.localeCompare(b.code));
  }, [data]);
  const rows = useMemo(() => all.filter((a) => quick === "All" || a.type === quick), [all, quick]);

  const actions = useMemo(
    () => ({
      open: (r: unknown) => drawers.open({ kind: "account", mode: "view", id: (r as AccountRow).id }),
      edit: (r: unknown) => drawers.open({ kind: "account", mode: "edit", id: (r as AccountRow).id }),
      remove: (r: unknown) => {
        const a = r as AccountRow;
        if (Object.values(SYSTEM_CODES).includes(a.code as never)) toast.error(`${a.name} is a system account and cannot be deleted.`);
        else if (a.lines > 0) toast.error(`${a.name} has ${a.lines} posted line${a.lines === 1 ? "" : "s"}. Mark it inactive instead of deleting it.`);
        else drawers.requestDelete("account", a.id);
      },
    }),
    [drawers, toast],
  );

  const columns: Column<AccountRow>[] = [
    { key: "code", header: "Code", width: 90, render: (r) => <span className={styles.link}>{r.code}</span> },
    { key: "name", header: "Account name", width: 250, padLeft: 0, render: (r) => <span className={styles.strong}>{r.name}</span> },
    { key: "type", header: "Type", width: 110, padLeft: 0, render: (r) => <Badge tone="acct" shape="tag">{r.type}</Badge> },
    { key: "subtype", header: "Subtype", width: 150, padLeft: 0, render: (r) => <span className={styles.dim}>{r.subtype}</span> },
    { key: "normalBalance", header: "Normal", width: 80, padLeft: 0, render: (r) => <span className={styles.dim}>{r.normalBalance === "debit" ? "Debit" : "Credit"}</span> },
    { key: "balance", header: "Balance", width: 140, align: "right", render: (r) => <Money cents={r.balance} /> },
    { key: "lines", header: "Lines", width: 80, align: "right", render: (r) => <span className={styles.dim}>{r.lines}</span> },
    { key: "status", header: "Status", width: 100, padLeft: 16, render: (r) => <Badge tone={r.active ? "statusPaid" : "statusVoid"}>{r.status}</Badge> },
    { key: "actions", header: "Actions", width: 100, padLeft: 0, render: (r) => <RowActions icons={["edit", "delete"]} label={r.name} iconSize={15} /> },
  ];
  const fields = [
    field("Code", "code"), field("Account name", "name"), field("Type", "type", { kind: "select" }), field("Subtype", "subtype"),
    field("Normal balance", "normalBalance"), field("Balance", "balance", { type: "number" }), field("Posted lines", "lines", { type: "number" }), field("Status", "status", { kind: "select" }),
  ];

  return (
    <AisList<AccountRow>
      title="Chart of Accounts"
      subtitle={`${all.length} accounts · balances as of ${data.settings.reportingDate}`}
      singular="account"
      plural="accounts"
      rows={rows}
      loading={!ready}
      columns={columns}
      fields={fields}
      rowLabel={(r) => `${r.code} ${r.name}`}
      actions={actions}
      create={{ label: "New account", onClick: () => drawers.open({ kind: "account", mode: "create" }) }}
      exportSpec={{ filename: "chart-of-accounts", headers: ["Code", "Name", "Type", "Subtype", "Normal balance", "Balance", "Posted lines", "Status"], row: (r) => [r.code, r.name, r.type, r.subtype, r.normalBalance, (r.balance / 100).toFixed(2), r.lines, r.status] }}
      above={
        <QuickFilters
          label="Filter accounts by type"
          value={quick}
          onChange={setQuick}
          options={[{ value: "All", label: "All", count: all.length }, ...ACCOUNT_TYPES.map((t) => ({ value: t, label: t, count: all.filter((a) => a.type === t).length }))]}
        />
      }
    />
  );
}
