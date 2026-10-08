"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { field } from "@/components/popovers/fields";
import type { Column } from "@/components/table/DataTable";
import { Badge } from "@/components/ui/Badge";
import { addDays, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { accountBalance, postedLines, signedBalance } from "@/services/ais/ledger";
import styles from "../ais.module.css";
import { AisList, ChipDate, ChipSelect } from "../AisList";
import { Money } from "../cells";
import { useAis } from "../AisProvider";
import { useAisDrawers } from "../AisDrawers";

interface LedgerRow {
  id: string;
  date: string;
  entryId: string;
  entryNumber: string;
  accountId: string;
  account: string;
  description: string;
  source: string;
  debit: number;
  credit: number;
  /** Running balance, only when a single account is selected. */
  balance: number | null;
}

/** Read-only view of every posted journal line. Pick an account to see its running balance. */
export function LedgerPage() {
  const { data, ready } = useAis();
  const drawers = useAisDrawers();
  const params = useSearchParams();
  const startOfYear = `${data.settings.fiscalYear}-${String(data.settings.fiscalYearStartMonth).padStart(2, "0")}-01`;

  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState(startOfYear);
  const [to, setTo] = useState(data.settings.reportingDate);

  // settings load asynchronously: adopt the books' dates once they are known, then honour ?account=
  useEffect(() => {
    if (!ready) return;
    setFrom(startOfYear);
    setTo(data.settings.reportingDate);
  }, [ready, startOfYear, data.settings.reportingDate]);
  const paramAccount = params.get("account");
  useEffect(() => {
    if (paramAccount && data.accounts.some((a) => a.id === paramAccount)) setAccountId(paramAccount);
  }, [paramAccount, data.accounts]);

  const account = data.accounts.find((a) => a.id === accountId);

  const { rows, opening, closing } = useMemo(() => {
    const lines = postedLines(data)
      .filter((l) => l.date >= from && l.date <= to && (!accountId || l.accountId === accountId))
      .sort((a, b) => a.date.localeCompare(b.date) || a.entryNumber.localeCompare(b.entryNumber));
    const opening = account ? accountBalance(data, account.id, { to: addDays(from, -1) }) : 0;
    let running = opening;
    const rows: LedgerRow[] = lines.map((l) => {
      const a = data.accounts.find((x) => x.id === l.accountId);
      if (account && a) running += signedBalance(a, l.debit, l.credit);
      return {
        id: `${l.entryId}:${l.id}`,
        date: l.date,
        entryId: l.entryId,
        entryNumber: l.entryNumber,
        accountId: l.accountId,
        account: a ? `${a.code} · ${a.name}` : "Unknown account",
        description: l.description || l.memo,
        source: l.source,
        debit: l.debit,
        credit: l.credit,
        balance: account ? running : null,
      };
    });
    return { rows, opening, closing: running };
  }, [data, accountId, account, from, to]);

  const debit = rows.reduce((s, r) => s + r.debit, 0);
  const credit = rows.reduce((s, r) => s + r.credit, 0);

  const actions = useMemo(() => ({ open: (r: unknown) => drawers.open({ kind: "journal", mode: "view", id: (r as LedgerRow).entryId }) }), [drawers]);

  const columns: Column<LedgerRow>[] = [
    { key: "date", header: "Date", width: 124, render: (r) => <span className={styles.dim}>{formatDate(r.date)}</span> },
    { key: "entryNumber", header: "Entry #", width: 90, padLeft: 0, render: (r) => <span className={styles.link}>{r.entryNumber}</span> },
    { key: "account", header: "Account", width: 250, padLeft: 0, render: (r) => <span className={styles.strong}>{r.account}</span> },
    { key: "description", header: "Description", width: 210, padLeft: 0, render: (r) => <span className={styles.dim}>{r.description}</span> },
    { key: "source", header: "Source", width: 100, padLeft: 0, render: (r) => <Badge tone={r.source === "Manual" ? "statusOpen" : "statusPartial"}>{r.source}</Badge> },
    { key: "debit", header: "Debit", width: 110, align: "right", render: (r) => <Money cents={r.debit} dashZero /> },
    { key: "credit", header: "Credit", width: 110, align: "right", render: (r) => <Money cents={r.credit} dashZero /> },
    { key: "balance", header: "Balance", width: 130, align: "right", render: (r) => (r.balance === null ? <span className={styles.muted}>Select an account</span> : <Money cents={r.balance} />) },
  ];
  const fields = [
    field("Date", "date", { type: "date" }), field("Entry #", "entryNumber"), field("Account", "account"), field("Description", "description"),
    field("Source", "source", { kind: "select" }), field("Debit", "debit", { type: "number" }), field("Credit", "credit", { type: "number" }),
  ];

  return (
    <AisList<LedgerRow>
      title="General Ledger"
      subtitle={account ? `${account.code} · ${account.name}` : "All accounts · posted entries only"}
      singular="ledger line"
      plural="ledger lines"
      rows={rows}
      loading={!ready}
      columns={columns}
      fields={fields}
      rowLabel={(r) => `${r.entryNumber} ${r.account}`}
      actions={actions}
      pageSize={50}
      exportSpec={{ filename: `general-ledger${account ? `-${account.code}` : ""}`, headers: ["Date", "Entry #", "Account", "Description", "Source", "Debit", "Credit", "Balance"], row: (r) => [r.date, r.entryNumber, r.account, r.description, r.source, (r.debit / 100).toFixed(2), (r.credit / 100).toFixed(2), r.balance === null ? "" : (r.balance / 100).toFixed(2)] }}
      emptyTitle="No ledger activity in this range"
      emptyDescription="Widen the date range or choose a different account. Draft entries are not part of the ledger until they are posted."
      toolbarExtra={
        <>
          <ChipSelect label="Account" value={accountId} onChange={setAccountId} options={[{ value: "", label: "All accounts" }, ...[...data.accounts].sort((a, b) => a.code.localeCompare(b.code)).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))]} />
          <ChipDate label="From" value={from} onChange={setFrom} />
          <ChipDate label="To" value={to} onChange={setTo} />
        </>
      }
      above={
        <div className={styles.cards}>
          <div className={styles.card}><div className={styles.cardLabel}>Total debits</div><div className={styles.cardValue}>{formatMoney(debit)}</div><div className={styles.cardNote}>{rows.length} lines in range</div></div>
          <div className={styles.card}><div className={styles.cardLabel}>Total credits</div><div className={styles.cardValue}>{formatMoney(credit)}</div><div className={styles.cardNote}>{debit === credit ? "Debits equal credits" : "Filtered view – not every side of each entry is shown"}</div></div>
          {account && (
            <>
              <div className={styles.card}><div className={styles.cardLabel}>Opening balance</div><div className={styles.cardValue}>{formatMoney(opening)}</div><div className={styles.cardNote}>Before {formatDate(from)}</div></div>
              <div className={styles.card}><div className={styles.cardLabel}>Closing balance</div><div className={styles.cardValue}>{formatMoney(closing)}</div><div className={styles.cardNote}>As of {formatDate(to)}</div></div>
            </>
          )}
        </div>
      }
    />
  );
}
