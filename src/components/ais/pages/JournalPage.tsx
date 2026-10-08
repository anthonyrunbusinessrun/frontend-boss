"use client";

import { useMemo } from "react";
import { field } from "@/components/popovers/fields";
import type { Column } from "@/components/table/DataTable";
import { Badge } from "@/components/ui/Badge";
import { RowActions } from "@/components/ui/RowActions";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/dates";
import { entryTotals } from "@/services/ais/ledger";
import type { JournalEntry } from "@/types/ais";
import styles from "../ais.module.css";
import { AisList, QuickFilters } from "../AisList";
import { EntryStatusBadge, Money } from "../cells";
import { useAis } from "../AisProvider";
import { useAisDrawers } from "../AisDrawers";
import { useQuickParam } from "../useQuickParam";

type EntryRow = JournalEntry & { amount: number; lineCount: number; sourceLabel: string };

export function JournalPage() {
  const { data, ready } = useAis();
  const drawers = useAisDrawers();
  const toast = useToast();
  const [quick, setQuick] = useQuickParam(["status"], ["All", "Draft", "Posted"], "All");

  const all = useMemo<EntryRow[]>(
    () =>
      data.journalEntries
        .map((e) => ({ ...e, amount: entryTotals(e).debit, lineCount: e.lines.length, sourceLabel: e.source }))
        .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)),
    [data.journalEntries],
  );
  const rows = useMemo(() => all.filter((e) => quick === "All" || e.status === quick), [all, quick]);

  const actions = useMemo(
    () => ({
      open: (r: unknown) => drawers.open({ kind: "journal", mode: "view", id: (r as EntryRow).id }),
      edit: (r: unknown) => {
        const e = r as EntryRow;
        const editable = e.source === "Manual" && e.status === "Draft";
        if (!editable) toast.info(e.source === "Manual" ? "Posted entries cannot be edited. Open the entry to reverse it." : "Entries posted by a document are changed by editing that document.");
        drawers.open({ kind: "journal", mode: editable ? "edit" : "view", id: e.id });
      },
      remove: (r: unknown) => {
        const e = r as EntryRow;
        if (e.source !== "Manual") toast.error("Entries posted by invoices, bills and payments are removed by changing the document.");
        else if (e.status === "Posted") toast.error("Posted entries cannot be deleted. Open the entry and reverse it instead.");
        else drawers.requestDelete("journal", e.id);
      },
    }),
    [drawers, toast],
  );

  const columns: Column<EntryRow>[] = [
    { key: "number", header: "Entry #", width: 100, render: (r) => <span className={styles.link}>{r.number}</span> },
    { key: "date", header: "Date", width: 120, padLeft: 0, render: (r) => <span className={styles.dim}>{formatDate(r.date)}</span> },
    { key: "memo", header: "Memo", width: 330, padLeft: 0, render: (r) => <span className={styles.strong}>{r.memo}</span> },
    { key: "source", header: "Source", width: 130, padLeft: 0, render: (r) => <Badge tone={r.source === "Manual" ? "statusOpen" : "statusPartial"}>{r.source}</Badge> },
    { key: "lineCount", header: "Lines", width: 80, align: "right", render: (r) => <span className={styles.dim}>{r.lineCount}</span> },
    { key: "amount", header: "Amount", width: 140, align: "right", render: (r) => <Money cents={r.amount} /> },
    { key: "status", header: "Status", width: 110, padLeft: 16, render: (r) => <EntryStatusBadge status={r.status} /> },
    { key: "actions", header: "Actions", width: 110, padLeft: 0, render: (r) => <RowActions icons={["edit", "delete"]} label={r.number} iconSize={15} /> },
  ];
  const fields = [
    field("Entry #", "number"), field("Date", "date", { type: "date" }), field("Memo", "memo"), field("Source", "source", { kind: "select" }),
    field("Lines", "lineCount", { type: "number" }), field("Amount", "amount", { type: "number" }), field("Status", "status", { kind: "select" }),
  ];

  return (
    <AisList<EntryRow>
      title="Journal Entries"
      subtitle="Every entry must balance: total debits equal total credits."
      singular="journal entry"
      plural="journal entries"
      rows={rows}
      loading={!ready}
      columns={columns}
      fields={fields}
      rowLabel={(r) => r.number}
      actions={actions}
      create={{ label: "New journal entry", onClick: () => drawers.open({ kind: "journal", mode: "create" }) }}
      exportSpec={{ filename: "journal-entries", headers: ["Entry #", "Date", "Memo", "Source", "Lines", "Amount", "Status"], row: (r) => [r.number, r.date, r.memo, r.source, r.lineCount, (r.amount / 100).toFixed(2), r.status] }}
      emptyTitle={quick === "Draft" ? "No draft entries" : "No journal entries yet"}
      emptyDescription="Create a journal entry to record an adjustment, accrual or correction."
      above={
        <QuickFilters
          label="Filter entries by status"
          value={quick}
          onChange={setQuick}
          options={[
            { value: "All", label: "All", count: all.length },
            { value: "Draft", label: "Draft", count: all.filter((e) => e.status === "Draft").length },
            { value: "Posted", label: "Posted", count: all.filter((e) => e.status === "Posted").length },
          ]}
        />
      }
    />
  );
}
