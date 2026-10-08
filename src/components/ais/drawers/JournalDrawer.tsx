"use client";

import { Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Drawer } from "@/components/ui/Dialog";
import { Banner, FormGrid, SelectInput, TextInput } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/dates";
import { formatMoney, formatPlain, parseMoney } from "@/lib/money";
import { entryTotals } from "@/services/ais/ledger";
import { newId } from "@/services/ais/mutations";
import { validateJournalEntry } from "@/services/ais/validation";
import type { JournalEntry, JournalLine } from "@/types/ais";
import styles from "../ais.module.css";
import { EntryStatusBadge } from "../cells";
import { useAis, useAisActions } from "../AisProvider";
import { useAisDrawers, type DrawerMode, type DrawerRequest } from "../AisDrawers";
import { focusFirstInvalid, useDiscardGuard } from "./shared";

interface LineForm {
  id: string;
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

const blankLine = (): LineForm => ({ id: newId("jl"), accountId: "", description: "", debit: "", credit: "" });
const toForm = (l: JournalLine): LineForm => ({ id: l.id, accountId: l.accountId, description: l.description, debit: l.debit ? formatPlain(l.debit) : "", credit: l.credit ? formatPlain(l.credit) : "" });
const cents = (text: string) => (text.trim() === "" ? 0 : (parseMoney(text) ?? 0));
const badAmount = (text: string) => text.trim() !== "" && parseMoney(text) === null;

const SOURCE_KIND = { Invoice: "invoice", Bill: "bill", Payment: "payment" } as const;

/** Journal entry: view, create or edit (drafts). Debits must equal credits before it can be saved or posted. */
export function JournalDrawer({ request }: { request: DrawerRequest }) {
  const { data } = useAis();
  const act = useAisActions();
  const toast = useToast();
  const drawers = useAisDrawers();

  const existing = request.id ? data.journalEntries.find((e) => e.id === request.id) : undefined;
  const missing = request.mode !== "create" && !existing;
  useEffect(() => {
    if (missing) drawers.close();
  }, [missing, drawers]);

  // Posted and system-generated entries are read-only; a draft manual entry can be edited.
  const editable = !existing || (existing.source === "Manual" && existing.status === "Draft");
  const [mode, setMode] = useState<DrawerMode>(request.mode === "edit" && !editable ? "view" : request.mode);

  const initial = useMemo(
    () => ({
      date: existing?.date ?? data.settings.reportingDate,
      memo: existing?.memo ?? "",
      lines: existing ? existing.lines.map(toForm) : [blankLine(), blankLine()],
    }),
    [existing?.id],
  );
  const [date, setDate] = useState(initial.date);
  const [memo, setMemo] = useState(initial.memo);
  const [lines, setLines] = useState<LineForm[]>(initial.lines);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmReverse, setConfirmReverse] = useState(false);

  const editing = mode !== "view";
  const dirty = editing && JSON.stringify({ date, memo, lines }) !== JSON.stringify(initial);
  const { requestClose, dialog } = useDiscardGuard(dirty, () => drawers.close());

  const accountOptions = useMemo(() => {
    const used = new Set(existing?.lines.map((l) => l.accountId));
    return [...data.accounts]
      .filter((a) => a.active || used.has(a.id))
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }));
  }, [data.accounts, existing]);
  const accountName = (id: string) => data.accounts.find((a) => a.id === id);

  // live domain object + validation (amounts are exact cents)
  const draftEntry: Pick<JournalEntry, "date" | "memo" | "lines"> = useMemo(
    () => ({ date, memo, lines: lines.map((l) => ({ id: l.id, accountId: l.accountId, description: l.description, debit: cents(l.debit), credit: cents(l.credit) })) }),
    [date, memo, lines],
  );
  const v = useMemo(() => validateJournalEntry(draftEntry, data.accounts), [draftEntry, data.accounts]);
  const anyAmount = v.totals.debit > 0 || v.totals.credit > 0;
  const amountTextErrors = lines.some((l) => badAmount(l.debit) || badAmount(l.credit));

  if (missing) return null;

  const setLine = (id: string, patch: Partial<LineForm>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => setLines((ls) => (ls.length > 2 ? ls.filter((l) => l.id !== id) : ls));

  const save = async (post: boolean) => {
    setSubmitted(true);
    if (!v.valid || amountTextErrors) return focusFirstInvalid();
    setSaving(true);
    const entry: JournalEntry = { id: existing?.id ?? newId("je"), number: existing?.number ?? "", date, memo, status: "Draft", source: "Manual", lines: draftEntry.lines };
    const r = await act.saveJournalEntry(entry, post);
    setSaving(false);
    if (!r.ok) return;
    toast.success(post ? `Entry ${r.value.number} posted to the ledger.` : `Draft ${r.value.number} saved.`);
    drawers.close();
  };

  const post = async () => {
    if (!existing) return;
    setSaving(true);
    const r = await act.saveJournalEntry(existing, true);
    setSaving(false);
    if (r.ok) {
      toast.success(`Entry ${r.value.number} posted to the ledger.`);
      drawers.close();
    }
  };

  const reverse = async () => {
    if (!existing) return;
    setConfirmReverse(false);
    const r = await act.reverseJournalEntry(existing.id, data.settings.reportingDate);
    if (r.ok) {
      toast.success(`Entry ${existing.number} reversed by ${r.value.number}.`);
      drawers.close();
    }
  };

  const reversedBy = existing ? data.journalEntries.find((e) => e.reversalOf === existing.id) : undefined;
  const reversalOf = existing?.reversalOf ? data.journalEntries.find((e) => e.id === existing.reversalOf) : undefined;
  const totals = existing && !editing ? entryTotals(existing) : null;
  const diff = v.totals.difference;
  const formId = "journal-form";

  return (
    <>
      <Drawer
        open
        onClose={requestClose}
        width={860}
        title={mode === "create" ? "New journal entry" : mode === "edit" ? `Edit ${existing?.number}` : (existing?.number ?? "")}
        subtitle={mode === "view" ? existing?.memo : "Every entry needs equal debits and credits."}
        footerStart={
          mode === "view" && existing && existing.source === "Manual" && existing.status === "Draft" ? (
            <Button variant="secondary" size="md" icon={<Trash2 size={14} />} onClick={() => drawers.requestDelete("journal", existing.id)}>
              Delete draft
            </Button>
          ) : undefined
        }
        footer={
          mode === "view" ? (
            <>
              {existing?.source === "Manual" && existing.status === "Posted" && !reversedBy && !existing.reversalOf && (
                <Button variant="secondary" size="md" icon={<Undo2 size={14} />} onClick={() => setConfirmReverse(true)}>
                  Reverse entry
                </Button>
              )}
              <Button variant="secondary" size="md" onClick={() => drawers.close()}>Close</Button>
              {editable && existing && (
                <>
                  <Button variant="secondary" size="md" icon={<Pencil size={14} />} onClick={() => setMode("edit")}>Edit</Button>
                  <Button size="md" onClick={post} disabled={saving}>{saving ? "Posting…" : "Post entry"}</Button>
                </>
              )}
            </>
          ) : (
            <>
              <span className={styles.stickyNote} style={{ marginRight: "auto" }}>
                {v.balanced ? "Balanced – ready to save" : anyAmount ? `Out of balance by ${formatMoney(Math.abs(diff))}` : "Enter debit and credit amounts"}
              </span>
              <Button variant="secondary" size="md" onClick={requestClose}>Cancel</Button>
              <Button variant="secondary" size="md" onClick={() => save(false)} disabled={saving}>Save draft</Button>
              <Button type="submit" form={formId} size="md" disabled={saving}>{saving ? "Saving…" : "Post entry"}</Button>
            </>
          )
        }
      >
        {mode === "view" && existing && totals ? (
          <>
            <div className={styles.badgeRow}>
              <EntryStatusBadge status={existing.status} />
              <Badge tone={existing.source === "Manual" ? "statusOpen" : "statusPartial"}>{existing.source === "Manual" ? "Manual entry" : `From ${existing.source.toLowerCase()}`}</Badge>
              <span className={styles.dim}>{formatDate(existing.date)}</span>
            </div>
            {existing.source !== "Manual" && existing.sourceId && (
              <Banner tone="info">
                Posted automatically by {existing.source.toLowerCase()} {existing.memo.split(" · ")[0].replace(/^(Invoice|Bill|Payment) /, "")}. To change it, edit the {existing.source.toLowerCase()}.{" "}
                <button type="button" className={styles.linkBtn} onClick={() => drawers.open({ kind: SOURCE_KIND[existing.source as keyof typeof SOURCE_KIND], mode: "view", id: existing.sourceId })}>
                  Open {existing.source.toLowerCase()}
                </button>
              </Banner>
            )}
            {reversedBy && <Banner tone="warn">This entry was reversed by {reversedBy.number}.</Banner>}
            {reversalOf && <Banner tone="info">This entry reverses {reversalOf.number}.</Banner>}
            {existing.status === "Draft" && <Banner tone="warn">This draft has not been posted, so it does not affect the ledger or any report yet.</Banner>}
            <div className={styles.tableWrap}>
              <table className={styles.miniTable}>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Description</th>
                    <th className={styles.num}>Debit</th>
                    <th className={styles.num}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {existing.lines.map((l) => {
                    const a = accountName(l.accountId);
                    return (
                      <tr key={l.id}>
                        <td>{a ? `${a.code} · ${a.name}` : "Unknown account"}</td>
                        <td className={styles.dim}>{l.description || "–"}</td>
                        <td className={styles.num}>{l.debit ? formatMoney(l.debit) : "–"}</td>
                        <td className={styles.num}>{l.credit ? formatMoney(l.credit) : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Totals</td>
                    <td className={styles.num}>{formatMoney(totals.debit)}</td>
                    <td className={styles.num}>{formatMoney(totals.credit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          <form
            id={formId}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save(true);
            }}
          >
            {submitted && (!v.valid || amountTextErrors) && (
              <Banner>
                <strong>This entry cannot be saved yet.</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, listStyle: "disc" }}>
                  {v.summary.map((m) => <li key={m}>{m}</li>)}
                  {amountTextErrors && <li>Fix amounts that are not valid numbers.</li>}
                </ul>
              </Banner>
            )}
            <FormGrid columns={3}>
              <TextInput label="Entry date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} error={submitted && v.summary.includes("Choose a valid entry date.") ? "Choose a valid entry date." : undefined} data-autofocus="" />
              <TextInput label="Memo" required wide value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What is this entry for?" error={submitted && memo.trim() === "" ? "Add a memo describing the entry." : undefined} />
            </FormGrid>

            <div className={styles.block}>
              <h3 className={styles.blockTitle}>Lines</h3>
              <div className={styles.lines} role="group" aria-label="Journal lines">
                <div className={`${styles.lineHead} ${styles.journalCols}`} aria-hidden>
                  <span>#</span><span>Account</span><span>Description</span><span style={{ textAlign: "right" }}>Debit</span><span style={{ textAlign: "right" }}>Credit</span><span />
                </div>
                {lines.map((l, i) => {
                  const e = v.lines[l.id];
                  const showErr = submitted;
                  return (
                    <div key={l.id} className={`${styles.lineRow} ${styles.journalCols} ${showErr && e ? styles.lineRowBad : ""}`}>
                      <span className={styles.lineNo}>{i + 1}</span>
                      <SelectInput label={`Account, line ${i + 1}`} hideLabel value={l.accountId} placeholder="Select account…" options={accountOptions} onChange={(ev) => setLine(l.id, { accountId: ev.target.value })} error={showErr ? e?.account : undefined} />
                      <TextInput label={`Description, line ${i + 1}`} hideLabel value={l.description} placeholder="Optional" onChange={(ev) => setLine(l.id, { description: ev.target.value })} />
                      <TextInput label={`Debit, line ${i + 1}`} hideLabel inputMode="decimal" align="right" placeholder="0.00" value={l.debit} onChange={(ev) => setLine(l.id, { debit: ev.target.value, ...(ev.target.value.trim() !== "" ? { credit: "" } : {}) })} error={badAmount(l.debit) ? "Not a valid amount." : showErr ? e?.amount : undefined} />
                      <TextInput label={`Credit, line ${i + 1}`} hideLabel inputMode="decimal" align="right" placeholder="0.00" value={l.credit} onChange={(ev) => setLine(l.id, { credit: ev.target.value, ...(ev.target.value.trim() !== "" ? { debit: "" } : {}) })} error={badAmount(l.credit) ? "Not a valid amount." : undefined} />
                      <button type="button" className={styles.lineRemove} aria-label={`Remove line ${i + 1}`} title={lines.length <= 2 ? "An entry needs at least two lines" : "Remove line"} disabled={lines.length <= 2} onClick={() => removeLine(l.id)}>
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button type="button" className={styles.addLine} onClick={() => setLines((ls) => [...ls, blankLine()])}>
                <Plus size={15} strokeWidth={2.5} aria-hidden /> Add line
              </button>

              <div className={styles.totals} aria-live="polite">
                <div className={styles.totalRow}><span>Total debits</span><span>{formatMoney(v.totals.debit)}</span></div>
                <div className={styles.totalRow}><span>Total credits</span><span>{formatMoney(v.totals.credit)}</span></div>
                <div className={`${styles.totalRow} ${styles.totalRowStrong}`}>
                  <span>Difference</span>
                  <span className={v.balanced ? styles.totalGood : anyAmount ? styles.totalBad : undefined}>{formatMoney(Math.abs(diff))}</span>
                </div>
              </div>
              {anyAmount && (
                <div style={{ marginTop: 12 }}>
                  {v.balanced ? (
                    <Banner tone="ok">Balanced. Total debits equal total credits.</Banner>
                  ) : (
                    <Banner>
                      <strong>Out of balance by {formatMoney(Math.abs(diff))}.</strong> {diff > 0 ? "Debits are higher than credits: add a credit or reduce a debit." : "Credits are higher than debits: add a debit or reduce a credit."} The entry cannot be saved until it balances.
                    </Banner>
                  )}
                </div>
              )}
            </div>
          </form>
        )}
      </Drawer>
      <ConfirmDialog
        open={confirmReverse}
        title="Reverse this entry?"
        message={<>A new posted entry dated <strong>{formatDate(data.settings.reportingDate)}</strong> will be created with every debit and credit swapped. {existing?.number} stays in the ledger as the audit trail.</>}
        confirmLabel="Reverse entry"
        onCancel={() => setConfirmReverse(false)}
        onConfirm={reverse}
      />
      {dialog}
    </>
  );
}
